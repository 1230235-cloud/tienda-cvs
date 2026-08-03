const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess = null;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function startServer() {
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = spawn('node', [serverPath], {
    cwd: __dirname,
    env: { ...process.env, PORT: '3000', HOST: '0.0.0.0' },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER] ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR] ${data}`);
  });

  serverProcess.on('error', (err) => {
    console.error('Error al iniciar servidor:', err);
  });
}

function createWindow(serverIp) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'public', 'assets', 'Logo vida sana-02.png'),
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (serverIp === 'base') {
    startServer();
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(`http://${serverIp}:3000`);
  }
}

function showModeSelector() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'public', 'assets', 'Logo vida sana-02.png'),
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, 'mode-selector.html'));

  mainWindow.on('closed', () => {
    if (mainWindow) mainWindow = null;
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    app.quit();
  });
}

ipcMain.on('select-mode', (event, mode) => {
  if (mode === 'base') {
    const localIP = getLocalIP();
    event.sender.send('mode-selected', { mode: 'base', ip: localIP });
    createWindow('base');
  } else if (mode === 'client') {
    mainWindow.loadFile(path.join(__dirname, 'client-config.html'));
  }
});

ipcMain.on('connect-to-server', (event, serverIp) => {
  event.sender.send('mode-selected', { mode: 'client', ip: serverIp });
  createWindow(serverIp);
});

app.whenReady().then(() => {
  showModeSelector();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showModeSelector();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    app.quit();
  }
});

autoUpdater.setFeedURL({
  provider: 'github',
  owner: '1230235-cloud',
  repo: 'tienda-cvs'
});

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available');
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});
