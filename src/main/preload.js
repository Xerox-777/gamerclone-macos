/**
 * GamerClone - Preload Script
 * Securely exposes IPC methods to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gamerclone', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // License
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  
  // Window selection
  getWindows: () => ipcRenderer.invoke('get-windows'),
  selectWindow: (id, name) => ipcRenderer.invoke('select-window', { id, name }),
  
  // Capture control
  toggleCapture: () => ipcRenderer.invoke('toggle-capture'),
  
  // Game profiles
  getGameProfiles: () => ipcRenderer.invoke('get-game-profiles'),
  
  // Audio
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  testVoice: () => ipcRenderer.invoke('test-voice'),
  
  // Event listeners
  onPTTStatus: (callback) => {
    ipcRenderer.on('ptt-status', (event, data) => callback(data));
  },
  onQueryComplete: (callback) => {
    ipcRenderer.on('query-complete', (event, data) => callback(data));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Log when preload completes
console.log('GamerClone preload script loaded');
