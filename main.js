const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');
const http = require('http');
const { fork } = require('child_process');

let selectorWindow;
let serverProcess = null;
let appIsQuitting = false;

const TAILSCALE_SERVER_URL = 'http://100.91.160.121:3000';

process.on('uncaughtException', (error) => {
    console.error('Error no capturado prevenido:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  dialog.showErrorBox('Fallo Crítico', (reason && reason.stack) ? reason.stack : String(reason));
});

function checkServerHealth(targetUrl) {
    return new Promise((resolve) => {
        const healthUrl = targetUrl.replace(/\/$/, '') + '/api/health';
        const req = http.request({
            hostname: new URL(healthUrl).hostname,
            port: new URL(healthUrl).port,
            path: '/api/health',
            method: 'GET',
            timeout: 3000
        }, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const ip = net.address;
        if ((ip.startsWith('10.') && !ip.startsWith('100.')) || ip.startsWith('192.168.')) {
          return ip;
        }
      }
    }
  }
  return 'localhost';
}

function waitForServer(retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryConnect = () => {
      attempts++;
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve(true);
      });

      req.on('error', () => {
        if (attempts >= retries) {
          reject(new Error('Servidor no respondió después de ' + ((retries * delay) / 1000) + ' segundos'));
        } else {
          setTimeout(tryConnect, delay);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attempts >= retries) {
          reject(new Error('Servidor no respondió después de ' + ((retries * delay) / 1000) + ' segundos'));
        } else {
          setTimeout(tryConnect, delay);
        }
      });

      req.end();
    };

    tryConnect();
  });
}

function startServer() {
  if (serverProcess) return;

  const serverPath = app.isPackaged
    ? path.join(app.getAppPath(), 'server.js')
    : path.join(__dirname, 'server.js');

  console.log('Iniciando servidor en:', serverPath);

  const options = {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      USER_DATA_PATH: app.getPath('userData')
    },
    execPath: process.execPath,
    stdio: 'inherit'
  };

  try {
    serverProcess = fork(serverPath, [], options);

    if (!serverProcess) {
      throw new Error('No se pudo instanciar el proceso del servidor.');
    }

    serverProcess.on('error', (err) => {
      console.error('Error en proceso hijo de Express:', err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`Proceso de Express finalizó con código ${code} y señal ${signal}`);
      serverProcess = null;
      
      if (!appIsQuitting && selectorWindow && !selectorWindow.isDestroyed()) {
        console.log('Reiniciando servidor automáticamente...');
        setTimeout(() => {
          startServer();
        }, 500);
      }
    });

  } catch (err) {
    console.error('Excepción al lanzar fork:', err);
    throw err;
  }
}

function showModeSelector() {
  selectorWindow = new BrowserWindow({
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
    autoHideMenuBar: true
  });

  selectorWindow.loadFile(path.join(__dirname, 'mode-selector.html'));

  selectorWindow.webContents.on('crashed', (event) => {
    console.error('La página del selector crasheó, reiniciando...');
    setTimeout(() => {
      if (selectorWindow && !selectorWindow.isDestroyed()) {
        selectorWindow.reload();
      }
    }, 1000);
  });

  selectorWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Error al cargar ${validatedURL || 'página'}: ${errorDescription} (${errorCode})`);
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.loadFile(path.join(__dirname, 'mode-selector.html'));
    }
  });

  selectorWindow.webContents.on('login', (event, authenticationResponseDetails, authInfo, callback) => {
    if (authInfo.scheme === 'basic' || authInfo.scheme === 'digest') {
      event.preventDefault();
      callback('admin', 'vidasanaCE');
    }
  });

  selectorWindow.on('closed', () => {
    selectorWindow = null;
  });
}

ipcMain.on('select-mode', (event, mode) => {
  if (mode === 'base') {
    const localIP = getLocalIP();
    event.sender.send('mode-selected', { mode: 'base', ip: localIP });

    try {
      startServer();
      if (selectorWindow && !selectorWindow.isDestroyed()) {
        selectorWindow.loadFile(path.join(__dirname, 'public', 'login.html'));
        selectorWindow.maximize();
      }
    } catch (err) {
      console.error('Error al iniciar servidor:', err);
      dialog.showErrorBox('Fallo Crítico', err.stack || err.message);
    }
  } else if (mode === 'client') {
    // Cliente: el prompt se maneja en el frontend mode-selector.html
  }
});

ipcMain.on('connect-to-server', async (event, serverIp) => {
  event.sender.send('mode-selected', { mode: 'client', ip: serverIp });
  
  const targetUrl = TAILSCALE_SERVER_URL || `http://${(serverIp || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0].trim()}:3000`;
  
  if (selectorWindow && !selectorWindow.isDestroyed()) {
    selectorWindow.webContents.openDevTools({ mode: 'detach' });
    
    const isHealthy = await checkServerHealth(targetUrl);
    
    if (isHealthy) {
      selectorWindow.loadURL(targetUrl).catch((err) => {
        console.error('Error al cargar servidor remoto:', err);
      });
    } else {
      console.error('Servidor no disponible:', targetUrl);
      selectorWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background: #fef2f2; color: #991b1b;">
          <h1>Error de conexión</h1>
          <p>No se pudo conectar con el Servidor Principal (100.91.160.121:3000).</p>
          <p>Verifica que el equipo Servidor esté encendido y con Tailscale activo.</p>
          <p><strong>${targetUrl}</strong></p>
          <button onclick="history.back()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Volver al selector</button>
        </body>
        </html>
      `));
    }
    selectorWindow.maximize();
  }
});

app.whenReady().then(() => {
  if (!app.isPackaged) {
    console.log('Modo desarrollo: auto-updater desactivado');
  } else {
    autoUpdater.checkForUpdatesAndNotify();
  }

  showModeSelector();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showModeSelector();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización Disponible',
    message: 'Se ha descargado una versión actualizada de SistemaInventario. La app se reiniciará para aplicar los cambios.',
    buttons: ['Reiniciar y Actualizar']
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

autoUpdater.autoDownload = true;
autoUpdater.logger = console;

autoUpdater.on('error', (error) => {
  console.log('AutoUpdater error (silenciado):', error);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

app.on('will-quit', () => {
  appIsQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
