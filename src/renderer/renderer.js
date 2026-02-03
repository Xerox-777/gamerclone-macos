/**
 * GamerClone - Renderer Script
 * Handles UI interactions and communication with main process
 */

// DOM Elements
const elements = {
  // Status
  statusBadge: document.getElementById('status-badge'),
  statusText: document.querySelector('.status-text'),
  
  // License
  licenseSection: document.getElementById('license-section'),
  licenseStatus: document.getElementById('license-status'),
  licenseKey: document.getElementById('license-key'),
  activateBtn: document.getElementById('activate-btn'),
  
  // Game Selection
  gameSection: document.getElementById('game-section'),
  windowSelect: document.getElementById('window-select'),
  refreshWindowsBtn: document.getElementById('refresh-windows-btn'),
  gameProfile: document.getElementById('game-profile'),
  
  // Voice Settings
  voiceSection: document.getElementById('voice-section'),
  pttKeyBtn: document.getElementById('ptt-key-btn'),
  currentPttKey: document.getElementById('current-ptt-key'),
  audioInput: document.getElementById('audio-input'),
  audioOutput: document.getElementById('audio-output'),
  testVoiceBtn: document.getElementById('test-voice-btn'),
  
  // PTT Indicator
  pttSection: document.getElementById('ptt-section'),
  pttIndicator: document.getElementById('ptt-indicator'),
  pttStatusText: document.getElementById('ptt-status-text'),
  
  // Footer
  captureToggle: document.getElementById('capture-toggle')
};

// Application state
let state = {
  isActivated: false,
  isCapturing: false,
  isRecordingHotkey: false,
  settings: {}
};

// ============================================================
// INITIALIZATION
// ============================================================

async function initialize() {
  console.log('Initializing GamerClone UI...');
  
  try {
    // Load settings from main process
    state.settings = await window.gamerclone.getSettings();
    state.isActivated = state.settings.isActivated;
    state.isCapturing = state.settings.isCapturing;
    
    // Update UI with loaded settings
    updateLicenseUI();
    updateGameUI();
    updateVoiceUI();
    updateStatusUI();
    
    // Load game profiles
    await loadGameProfiles();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup IPC listeners
    setupIPCListeners();
    
    console.log('GamerClone UI initialized');
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize application');
  }
}

// ============================================================
// UI UPDATES
// ============================================================

function updateLicenseUI() {
  const { isActivated, licenseKey } = state.settings;
  
  if (isActivated) {
    elements.licenseStatus.innerHTML = `
      <p>✅ License activated</p>
      <p style="font-size: 12px; color: var(--text-muted);">Key: ${maskLicenseKey(licenseKey)}</p>
    `;
    elements.licenseStatus.classList.add('active');
    elements.licenseKey.value = licenseKey;
    elements.activateBtn.textContent = 'Reactivate';
    
    // Enable other sections
    elements.gameSection.classList.remove('disabled');
    elements.voiceSection.classList.remove('disabled');
  } else {
    elements.licenseStatus.innerHTML = '<p>Enter your license key to activate GamerClone</p>';
    elements.licenseStatus.classList.remove('active');
    elements.activateBtn.textContent = 'Activate';
    
    // Disable other sections
    elements.gameSection.classList.add('disabled');
    elements.voiceSection.classList.add('disabled');
  }
}

function updateGameUI() {
  const { selectedWindowId, selectedWindowName, selectedGameProfile } = state.settings;
  
  if (selectedWindowName) {
    // Add selected window to dropdown if not already there
    const exists = Array.from(elements.windowSelect.options).some(opt => opt.value === selectedWindowId);
    if (!exists) {
      const option = document.createElement('option');
      option.value = selectedWindowId;
      option.textContent = selectedWindowName;
      elements.windowSelect.appendChild(option);
    }
    elements.windowSelect.value = selectedWindowId;
  }
  
  elements.gameProfile.value = selectedGameProfile || 'generic';
}

function updateVoiceUI() {
  const { pttKey, audioInputDevice, audioOutputDevice } = state.settings;
  
  elements.currentPttKey.textContent = pttKey || 'Not set';
  elements.audioInput.value = audioInputDevice || 'default';
  elements.audioOutput.value = audioOutputDevice || 'default';
}

function updateStatusUI() {
  const badge = elements.statusBadge;
  const text = elements.statusText;
  
  if (!state.isActivated) {
    badge.className = 'status-badge';
    text.textContent = 'Not Licensed';
  } else if (state.isCapturing) {
    badge.className = 'status-badge active';
    text.textContent = 'Ready';
  } else {
    badge.className = 'status-badge';
    text.textContent = 'Capture Off';
  }
  
  elements.captureToggle.checked = state.isCapturing;
}

function updatePTTIndicator(status) {
  const indicator = elements.pttIndicator;
  const statusText = elements.pttStatusText;
  
  indicator.classList.remove('listening', 'processing');
  
  if (status.active) {
    indicator.classList.add('listening');
    statusText.textContent = '🎤 Listening...';
    elements.statusBadge.className = 'status-badge listening';
    elements.statusText.textContent = 'Listening';
  } else if (status.processing) {
    indicator.classList.add('processing');
    statusText.textContent = '🧠 Processing...';
    elements.statusBadge.className = 'status-badge';
    elements.statusText.textContent = 'Processing';
  } else {
    statusText.textContent = 'Press your hotkey to talk';
    elements.statusBadge.className = 'status-badge active';
    elements.statusText.textContent = 'Ready';
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
  // License activation
  elements.activateBtn.addEventListener('click', handleActivateLicense);
  elements.licenseKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleActivateLicense();
  });
  
  // Format license key as user types
  elements.licenseKey.addEventListener('input', formatLicenseKeyInput);
  
  // Window selection
  elements.refreshWindowsBtn.addEventListener('click', refreshWindows);
  elements.windowSelect.addEventListener('change', handleWindowSelect);
  
  // Game profile selection
  elements.gameProfile.addEventListener('change', handleGameProfileChange);
  
  // PTT hotkey
  elements.pttKeyBtn.addEventListener('click', startHotkeyRecording);
  
  // Audio devices
  elements.audioInput.addEventListener('change', handleAudioInputChange);
  elements.audioOutput.addEventListener('change', handleAudioOutputChange);
  
  // Test voice
  elements.testVoiceBtn.addEventListener('click', handleTestVoice);
  
  // Capture toggle
  elements.captureToggle.addEventListener('change', handleCaptureToggle);
  
  // Global key listener for hotkey recording
  document.addEventListener('keydown', handleKeyDown);
}

function setupIPCListeners() {
  // PTT status updates
  window.gamerclone.onPTTStatus((status) => {
    updatePTTIndicator(status);
  });
  
  // Query completion
  window.gamerclone.onQueryComplete((result) => {
    if (result.success) {
      console.log('Query completed successfully');
    } else {
      console.error('Query failed:', result.error);
      showError(result.error);
    }
  });
}

// ============================================================
// HANDLERS
// ============================================================

async function handleActivateLicense() {
  const key = elements.licenseKey.value.trim();
  
  if (!key) {
    showError('Please enter a license key');
    return;
  }
  
  elements.activateBtn.disabled = true;
  elements.activateBtn.textContent = 'Activating...';
  
  try {
    const isValid = await window.gamerclone.activateLicense(key);
    
    if (isValid) {
      state.isActivated = true;
      state.settings.isActivated = true;
      state.settings.licenseKey = key;
      updateLicenseUI();
      updateStatusUI();
      showSuccess('License activated successfully!');
    } else {
      showError('Invalid license key. Please check and try again.');
    }
  } catch (error) {
    showError('Failed to validate license. Please check your internet connection.');
  } finally {
    elements.activateBtn.disabled = false;
    elements.activateBtn.textContent = state.isActivated ? 'Reactivate' : 'Activate';
  }
}

async function refreshWindows() {
  elements.refreshWindowsBtn.disabled = true;
  elements.refreshWindowsBtn.textContent = '⏳ Loading...';
  
  try {
    const windows = await window.gamerclone.getWindows();
    
    // Clear existing options
    elements.windowSelect.innerHTML = '<option value="">-- Select a window --</option>';
    
    // Add windows to dropdown
    windows.forEach(win => {
      const option = document.createElement('option');
      option.value = win.id;
      option.textContent = win.name;
      elements.windowSelect.appendChild(option);
    });
    
    // Restore selection if previously selected
    if (state.settings.selectedWindowId) {
      elements.windowSelect.value = state.settings.selectedWindowId;
    }
  } catch (error) {
    console.error('Failed to refresh windows:', error);
    showError('Failed to get window list');
  } finally {
    elements.refreshWindowsBtn.disabled = false;
    elements.refreshWindowsBtn.textContent = '🔄 Refresh';
  }
}

async function handleWindowSelect() {
  const windowId = elements.windowSelect.value;
  const windowName = elements.windowSelect.options[elements.windowSelect.selectedIndex]?.text || '';
  
  if (windowId) {
    await window.gamerclone.selectWindow(windowId, windowName);
    state.settings.selectedWindowId = windowId;
    state.settings.selectedWindowName = windowName;
    
    // Try to auto-detect game profile from window name
    autoDetectGameProfile(windowName);
    
    showSuccess(`Selected: ${windowName}`);
  }
}

async function handleGameProfileChange() {
  const profile = elements.gameProfile.value;
  await window.gamerclone.saveSettings({ selectedGameProfile: profile });
  state.settings.selectedGameProfile = profile;
}

function startHotkeyRecording() {
  state.isRecordingHotkey = true;
  elements.pttKeyBtn.textContent = 'Press any key...';
  elements.pttKeyBtn.classList.add('recording');
}

function handleKeyDown(e) {
  if (!state.isRecordingHotkey) return;
  
  e.preventDefault();
  
  let keyName = e.key;
  
  // Handle special keys
  if (e.key === ' ') keyName = 'Space';
  if (e.key === 'Escape') {
    // Cancel recording
    state.isRecordingHotkey = false;
    elements.pttKeyBtn.textContent = 'Click to set hotkey';
    elements.pttKeyBtn.classList.remove('recording');
    return;
  }
  
  // Build key combo string
  let combo = [];
  if (e.ctrlKey) combo.push('Ctrl');
  if (e.altKey) combo.push('Alt');
  if (e.shiftKey) combo.push('Shift');
  if (!['Control', 'Alt', 'Shift'].includes(e.key)) {
    combo.push(keyName);
  }
  
  const hotkeyString = combo.join('+');
  
  // Save the hotkey
  savePTTKey(hotkeyString);
}

async function savePTTKey(key) {
  state.isRecordingHotkey = false;
  elements.pttKeyBtn.textContent = 'Click to set hotkey';
  elements.pttKeyBtn.classList.remove('recording');
  elements.currentPttKey.textContent = key;
  
  await window.gamerclone.saveSettings({ pttKey: key });
  state.settings.pttKey = key;
  
  showSuccess(`Hotkey set to: ${key}`);
}

async function handleAudioInputChange() {
  const device = elements.audioInput.value;
  await window.gamerclone.saveSettings({ audioInputDevice: device });
  state.settings.audioInputDevice = device;
}

async function handleAudioOutputChange() {
  const device = elements.audioOutput.value;
  await window.gamerclone.saveSettings({ audioOutputDevice: device });
  state.settings.audioOutputDevice = device;
}

async function handleTestVoice() {
  elements.testVoiceBtn.disabled = true;
  elements.testVoiceBtn.textContent = '🔊 Testing...';
  
  try {
    const success = await window.gamerclone.testVoice();
    
    if (success) {
      showSuccess('Voice test successful!');
    } else {
      showError('Voice test failed. Check your API configuration.');
    }
  } catch (error) {
    showError('Voice test failed');
  } finally {
    elements.testVoiceBtn.disabled = false;
    elements.testVoiceBtn.textContent = '🔊 Test Voice';
  }
}

async function handleCaptureToggle() {
  const isCapturing = await window.gamerclone.toggleCapture();
  state.isCapturing = isCapturing;
  updateStatusUI();
}

// ============================================================
// HELPERS
// ============================================================

async function loadGameProfiles() {
  try {
    const profiles = await window.gamerclone.getGameProfiles();
    
    elements.gameProfile.innerHTML = '';
    
    // Get profile list
    const profileList = Object.values(profiles).map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon
    }));
    
    profileList.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = `${profile.icon} ${profile.name}`;
      elements.gameProfile.appendChild(option);
    });
    
    // Restore selection
    if (state.settings.selectedGameProfile) {
      elements.gameProfile.value = state.settings.selectedGameProfile;
    }
  } catch (error) {
    console.error('Failed to load game profiles:', error);
  }
}

function autoDetectGameProfile(windowName) {
  const name = windowName.toLowerCase();
  
  const profileMap = {
    'minecraft': 'minecraft',
    'valheim': 'valheim',
    'terraria': 'terraria',
    'valorant': 'valorant',
    'counter-strike': 'csgo',
    'cs2': 'csgo',
    'fortnite': 'fortnite',
    'apex legends': 'apex',
    'overwatch': 'overwatch',
    'league of legends': 'lol',
    'dota 2': 'dota2',
    'elden ring': 'elden_ring',
    'world of warcraft': 'wow',
    'rocket league': 'rocket_league',
    'ea fc': 'fifa',
    'fifa': 'fifa',
    'civilization': 'civ6',
    'age of empires': 'aoe4'
  };
  
  for (const [keyword, profileId] of Object.entries(profileMap)) {
    if (name.includes(keyword)) {
      elements.gameProfile.value = profileId;
      handleGameProfileChange();
      showSuccess(`Auto-detected game: ${profileId}`);
      return;
    }
  }
}

function formatLicenseKeyInput(e) {
  let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Add dashes every 4 characters
  let formatted = '';
  for (let i = 0; i < value.length && i < 16; i++) {
    if (i > 0 && i % 4 === 0) formatted += '-';
    formatted += value[i];
  }
  
  e.target.value = formatted;
}

function maskLicenseKey(key) {
  if (!key) return '';
  const parts = key.split('-');
  if (parts.length < 2) return '****';
  return `${parts[0]}-****-****-${parts[parts.length - 1]}`;
}

function showSuccess(message) {
  // Simple toast notification - could be enhanced with a proper toast library
  console.log('Success:', message);
  
  const toast = document.createElement('div');
  toast.className = 'toast success';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent-secondary);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 13px;
    z-index: 1000;
    animation: toastIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function showError(message) {
  console.error('Error:', message);
  
  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent-danger);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 13px;
    z-index: 1000;
    animation: toastIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add toast animations
const style = document.createElement('style');
style.textContent = `
  @keyframes toastIn {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes toastOut {
    from { opacity: 1; transform: translate(-50%, 0); }
    to { opacity: 0; transform: translate(-50%, -20px); }
  }
`;
document.head.appendChild(style);

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener('DOMContentLoaded', initialize);
