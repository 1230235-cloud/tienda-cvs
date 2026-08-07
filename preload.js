const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startServerMode: () => ipcRenderer.send('select-mode', 'base'),
    connectToServer: (ip) => ipcRenderer.send('connect-to-server', ip),
    onModeSelected: (callback) => ipcRenderer.on('mode-selected', (event, data) => callback(data)),
    removeModeListener: () => ipcRenderer.removeAllListeners('mode-selected')
});