const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const db = require('./database');

const isElectron = process.versions && process.versions.electron;
const basePath = isElectron && app.isPackaged
    ? process.resourcesPath
    : __dirname;

const expressApp = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
expressApp.use(cors());
expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: true }));
expressApp.use(express.static(path.join(basePath, 'public')));

// Importar rutas
const inventarioRoutes = require('./routes/inventario');
const ventasRoutes = require('./routes/ventas');
const entradasRoutes = require('./routes/entradas');
const cortesRoutes = require('./routes/cortes');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

// Usar rutas
expressApp.use('/api/inventario', inventarioRoutes);
expressApp.use('/api/ventas', ventasRoutes);
expressApp.use('/api/entradas', entradasRoutes);
expressApp.use('/api/cortes', cortesRoutes);
expressApp.use('/api/dashboard', dashboardRoutes);
expressApp.use('/api/auth', authRoutes);

// Ruta principal
expressApp.get('/', (req, res) => {
    res.sendFile(path.join(basePath, 'public', 'index.html'));
});

// Iniciar servidor
const server = expressApp.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log(`Servidor corriendo en http://${localIP}:${PORT}`);
    console.log(`Modo: ${HOST === '0.0.0.0' ? 'SERVIDOR BASE (accesible desde otros dispositivos)' : 'LOCAL'}`);
    console.log(`Base path: ${basePath}`);
});

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

module.exports = expressApp;
