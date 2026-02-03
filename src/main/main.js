/**
 * GamerClone - Main Electron Process
 * Handles system tray, screenshot capture, hotkeys, and voice pipeline coordination
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, desktopCapturer, nativeImage, globalShortcut, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Modules we'll create
const VoicePipeline = require('./voice-pipeline');
const LicenseManager = require('./license-manager');

// Persistent storage for settings
const store = new Store({
  defaults: {
    licenseKey: '',
    selectedWindowId: null,
    selectedWindowName: '',
    selectedGameProfile: 'generic',
    pttKey: 'Mouse4',
    audioInputDevice: 'default',
    audioOutputDevice: 'default',
    captureInterval: 2000, // ms between screenshots
    screenshotCount: 5, // screenshots to send per query
    isActivated: false
  }
});

// Global state
let mainWindow = null;
let tray = null;
let voicePipeline = null;
let licenseManager = null;
let screenshotBuffer = [];
let captureInterval = null;
let isCapturing = false;
let isPTTActive = false;

// ============================================================
// APP LIFECYCLE
// ============================================================

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  // Initialize license manager
  licenseManager = new LicenseManager(store);
  
  // Create the main window (settings UI)
  createMainWindow();
  
  // Create system tray
  createTray();
  
  // Initialize voice pipeline
  voicePipeline = new VoicePipeline(store);
  
  // Setup IPC handlers
  setupIPC();
  
  // Register global hotkeys
  registerHotkeys();
  
  // Check license on startup
  await checkLicense();
  
  // Start screenshot capture if licensed and window selected
  if (store.get('isActivated') && store.get('selectedWindowId')) {
    startScreenshotCapture();
  }
});

app.on('window-all-closed', (e) => {
  // Don't quit when window is closed - keep running in tray
  e.preventDefault();
});

app.on('before-quit', () => {
  stopScreenshotCapture();
  globalShortcut.unregisterAll();
});

// ============================================================
// WINDOW MANAGEMENT
// ============================================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    resizable: false,
    frame: true,
    show: false, // Start hidden, show from tray
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  mainWindow.on('close', (e) => {
    // Hide instead of close
    e.preventDefault();
    mainWindow.hide();
  });
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// ============================================================
// SYSTEM TRAY
// ============================================================

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  
  updateTrayMenu();
  
  tray.setToolTip('GamerClone - Ready');
  
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function updateTrayMenu() {
  const isActivated = store.get('isActivated');
  const selectedWindow = store.get('selectedWindowName');
  const profile = store.get('selectedGameProfile');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isActivated ? '✓ Licensed' : '⚠ Not Licensed',
      enabled: false
    },
    {
      label: selectedWindow ? `Game: ${selectedWindow}` : 'No game selected',
      enabled: false
    },
    {
      label: `Profile: ${profile}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Settings',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: isCapturing ? 'Stop Capture' : 'Start Capture',
      click: () => {
        if (isCapturing) {
          stopScreenshotCapture();
        } else {
          startScreenshotCapture();
        }
        updateTrayMenu();
      },
      enabled: isActivated && !!store.get('selectedWindowId')
    },
    { type: 'separator' },
    {
      label: 'Quit GamerClone',
      click: () => {
        app.exit(0);
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

function updateTrayTooltip(status) {
  if (tray) {
    tray.setToolTip(`GamerClone - ${status}`);
  }
}

// ============================================================
// WINDOW ENUMERATION (for game selection)
// ============================================================

async function getOpenWindows() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    // Filter out empty/system windows and our own window
    const windows = sources
      .filter(source => {
        const name = source.name.toLowerCase();
        return source.name.trim() !== '' &&
               !name.includes('gamerclone') &&
               !name.includes('electron') &&
               !name.includes('task manager') &&
               !name.includes('settings');
      })
      .map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
      }));
    
    return windows;
  } catch (error) {
    console.error('Error getting windows:', error);
    return [];
  }
}

// ============================================================
// SCREENSHOT CAPTURE
// ============================================================

async function captureScreenshot() {
  const windowId = store.get('selectedWindowId');
  if (!windowId) return null;
  
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1280, height: 720 } // Optimized for Claude Vision
    });
    
    const targetWindow = sources.find(s => s.id === windowId);
    if (!targetWindow) {
      console.warn('Target window not found - may be minimized or closed');
      return null;
    }
    
    const screenshot = {
      timestamp: Date.now(),
      data: targetWindow.thumbnail.toJPEG(80), // JPEG at 80% quality
      base64: targetWindow.thumbnail.toDataURL()
    };
    
    return screenshot;
  } catch (error) {
    console.error('Screenshot capture error:', error);
    return null;
  }
}

function startScreenshotCapture() {
  if (isCapturing) return;
  
  const interval = store.get('captureInterval');
  
  isCapturing = true;
  screenshotBuffer = [];
  
  captureInterval = setInterval(async () => {
    const screenshot = await captureScreenshot();
    if (screenshot) {
      screenshotBuffer.push(screenshot);
      
      // Keep only recent screenshots
      const maxScreenshots = store.get('screenshotCount') * 2; // Buffer extra
      if (screenshotBuffer.length > maxScreenshots) {
        screenshotBuffer.shift();
      }
    }
  }, interval);
  
  updateTrayTooltip('Capturing');
  console.log('Screenshot capture started');
}

function stopScreenshotCapture() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  isCapturing = false;
  updateTrayTooltip('Ready');
  console.log('Screenshot capture stopped');
}

function getRecentScreenshots(count = 5) {
  return screenshotBuffer.slice(-count);
}

// ============================================================
// GLOBAL HOTKEYS (Push-to-Talk)
// ============================================================

function registerHotkeys() {
  const pttKey = store.get('pttKey');
  
  // For mouse buttons, we need a different approach
  // Electron's globalShortcut doesn't support mouse buttons directly
  // We'll use the node-global-key-listener package for this
  
  try {
    const { GlobalKeyboardListener } = require('node-global-key-listener');
    const keyListener = new GlobalKeyboardListener();
    
    keyListener.addListener((e, down) => {
      // Handle keyboard PTT
      if (e.name === pttKey && e.state === 'DOWN' && !isPTTActive) {
        handlePTTStart();
      } else if (e.name === pttKey && e.state === 'UP' && isPTTActive) {
        handlePTTEnd();
      }
    });
    
    console.log(`PTT hotkey registered: ${pttKey}`);
  } catch (error) {
    console.error('Error setting up global key listener:', error);
    
    // Fallback to Electron's globalShortcut for keyboard keys
    if (pttKey && !pttKey.startsWith('Mouse')) {
      globalShortcut.register(pttKey, () => {
        if (!isPTTActive) {
          handlePTTStart();
        }
      });
    }
  }
}

function handlePTTStart() {
  if (!store.get('isActivated')) {
    console.log('Not activated - ignoring PTT');
    return;
  }
  
  isPTTActive = true;
  updateTrayTooltip('Listening...');
  
  // Notify renderer
  if (mainWindow) {
    mainWindow.webContents.send('ptt-status', { active: true });
  }
  
  // Start voice capture
  if (voicePipeline) {
    voicePipeline.startListening();
  }
  
  console.log('PTT activated - listening');
}

function handlePTTEnd() {
  isPTTActive = false;
  updateTrayTooltip('Processing...');
  
  // Notify renderer
  if (mainWindow) {
    mainWindow.webContents.send('ptt-status', { active: false, processing: true });
  }
  
  // Stop voice capture and process
  if (voicePipeline) {
    const audioData = voicePipeline.stopListening();
    processVoiceQuery(audioData);
  }
  
  console.log('PTT released - processing');
}

// ============================================================
// VOICE QUERY PROCESSING
// ============================================================

async function processVoiceQuery(audioData) {
  try {
    const screenshots = getRecentScreenshots(store.get('screenshotCount'));
    const gameProfile = store.get('selectedGameProfile');
    
    // Send to voice pipeline for processing
    const response = await voicePipeline.processQuery(audioData, screenshots, gameProfile);
    
    updateTrayTooltip('Ready');
    
    if (mainWindow) {
      mainWindow.webContents.send('ptt-status', { active: false, processing: false });
      mainWindow.webContents.send('query-complete', { success: true });
    }
  } catch (error) {
    console.error('Voice query error:', error);
    updateTrayTooltip('Error - Ready');
    
    if (mainWindow) {
      mainWindow.webContents.send('ptt-status', { active: false, processing: false });
      mainWindow.webContents.send('query-complete', { success: false, error: error.message });
    }
  }
}

// ============================================================
// LICENSE VALIDATION
// ============================================================

async function checkLicense() {
  const licenseKey = store.get('licenseKey');
  if (!licenseKey) {
    store.set('isActivated', false);
    return false;
  }
  
  const isValid = await licenseManager.validateLicense(licenseKey);
  store.set('isActivated', isValid);
  updateTrayMenu();
  
  return isValid;
}

// ============================================================
// IPC HANDLERS (Communication with renderer)
// ============================================================

function setupIPC() {
  // Get app settings
  ipcMain.handle('get-settings', () => {
    return {
      licenseKey: store.get('licenseKey'),
      selectedWindowId: store.get('selectedWindowId'),
      selectedWindowName: store.get('selectedWindowName'),
      selectedGameProfile: store.get('selectedGameProfile'),
      pttKey: store.get('pttKey'),
      audioInputDevice: store.get('audioInputDevice'),
      audioOutputDevice: store.get('audioOutputDevice'),
      isActivated: store.get('isActivated'),
      isCapturing: isCapturing
    };
  });
  
  // Save settings
  ipcMain.handle('save-settings', (event, settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      store.set(key, value);
    });
    
    // Re-register hotkeys if PTT key changed
    if (settings.pttKey) {
      globalShortcut.unregisterAll();
      registerHotkeys();
    }
    
    updateTrayMenu();
    return true;
  });
  
  // Get open windows for selection
  ipcMain.handle('get-windows', async () => {
    return await getOpenWindows();
  });
  
  // Select a window
  ipcMain.handle('select-window', (event, { id, name }) => {
    store.set('selectedWindowId', id);
    store.set('selectedWindowName', name);
    updateTrayMenu();
    
    // Restart capture with new window
    if (isCapturing) {
      stopScreenshotCapture();
      startScreenshotCapture();
    }
    
    return true;
  });
  
  // Activate license
  ipcMain.handle('activate-license', async (event, licenseKey) => {
    store.set('licenseKey', licenseKey);
    const isValid = await checkLicense();
    
    if (isValid && store.get('selectedWindowId')) {
      startScreenshotCapture();
    }
    
    return isValid;
  });
  
  // Start/stop capture
  ipcMain.handle('toggle-capture', () => {
    if (isCapturing) {
      stopScreenshotCapture();
    } else {
      startScreenshotCapture();
    }
    return isCapturing;
  });
  
  // Get game profiles
  ipcMain.handle('get-game-profiles', () => {
    return require('../shared/game-profiles');
  });
  
  // Test voice pipeline
  ipcMain.handle('test-voice', async () => {
    if (voicePipeline) {
      return await voicePipeline.testConnection();
    }
    return false;
  });
  
  // Get audio devices
  ipcMain.handle('get-audio-devices', async () => {
    // This would use naudiodon to list devices
    // Simplified for MVP
    return {
      inputs: [{ id: 'default', name: 'Default Microphone' }],
      outputs: [{ id: 'default', name: 'Default Speakers' }]
    };
  });
}

module.exports = { app, mainWindow };
