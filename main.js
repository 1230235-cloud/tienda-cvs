const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const http = require('http');

let mainWindow;
let serverApp = null;

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
  if (serverApp) return true;

  try {
    console.log('Iniciando servidor Express...');
    serverApp = require('./server.js');
    console.log('Servidor Express cargado correctamente');
    return true;
  } catch (err) {
    console.error('Error al cargar servidor:', err);
    return err;
  }
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
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const targetUrl = serverIp === 'base' ? 'http://localhost:3000' : `http://${serverIp}:3000`;

  if (serverIp === 'base') {
    const serverResult = startServer();
    if (serverResult !== true) {
      const err = serverResult || new Error('Error desconocido al iniciar el servidor');
      const errorHtml = `
        <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background: #fef2f2; color: #991b1b;">
          <h1>Error al iniciar el servidor</h1>
          <p><strong>${err.message}</strong></p>
          <pre style="text-align: left; background: #fff; padding: 15px; border-radius: 8px; overflow: auto; max-height: 70vh; border: 1px solid #fecaca;">${err.stack || ''}</pre>
        </body>
        </html>
      `;
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHtml));
      return;
    }

    waitForServer()
      .then(() => {
        console.log('Servidor listo, cargando URL:', targetUrl);
        return mainWindow.loadURL(targetUrl);
      })
      .catch((err) => {
        console.error('Error esperando servidor:', err);
        const errorHtml = `
          <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center; background: #fef2f2; color: #991b1b;">
            <h1>Error de conexión</h1>
            <p><strong>${err.message}</strong></p>
            <pre style="text-align: left; background: #fff; padding: 15px; border-radius: 8px; overflow: auto; max-height: 70vh; border: 1px solid #fecaca;">${err.stack || ''}</pre>
          </body>
          </html>
        `;
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHtml));
      });
  } else {
    mainWindow.loadURL(targetUrl).catch((err) => {
      console.error('Error al cargar URL del cliente:', err);
      const errorHtml = `
        <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background: #fef2f2; color: #991b1b;">
          <h1>Error de conexión</h1>
          <p>No se pudo conectar al servidor en <strong>${targetUrl}</strong></p>
          <p><strong>${err.message}</strong></p>
          <pre style="text-align: left; background: #fff; padding: 15px; border-radius: 8px; overflow: auto; max-height: 70vh; border: 1px solid #fecaca;">${err.stack || ''}</pre>
        </body>
        </html>
      `;
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errorHtml));
    });
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
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, 'mode-selector.html'));

  mainWindow.on('closed', () => {
    if (mainWindow) mainWindow = null;
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
    app.quit();
  }
});
