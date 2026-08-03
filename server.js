const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const os = require('os');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Importar rutas
const inventarioRoutes = require('./routes/inventario');
const ventasRoutes = require('./routes/ventas');
const entradasRoutes = require('./routes/entradas');
const cortesRoutes = require('./routes/cortes');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

// Usar rutas
app.use('/api/inventario', inventarioRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/entradas', entradasRoutes);
app.use('/api/cortes', cortesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const server = app.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log(`Servidor corriendo en http://${localIP}:${PORT}`);
    console.log(`Modo: ${HOST === '0.0.0.0' ? 'SERVIDOR BASE (accesible desde otros dispositivos)' : 'LOCAL'}`);
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

module.exports = app;
