const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./database');
const bonjour = require('bonjour')();

const isPackaged = !!process.env.USER_DATA_PATH;
const basePath = isPackaged ? process.resourcesPath : __dirname;

db.initializeDatabase();

const expressApp = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
expressApp.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: true }));
const publicPath = path.join(__dirname, 'public');

// Importar rutas
const inventarioRoutes = require('./routes/inventario');
const ventasRoutes = require('./routes/ventas');
const entradasRoutes = require('./routes/entradas');
const cortesRoutes = require('./routes/cortes');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const ordenesCompraRoutes = require('./routes/ordenes_compra');

// Usar rutas
expressApp.use('/api/inventario', inventarioRoutes);
expressApp.use('/api/ventas', ventasRoutes);
expressApp.use('/api/entradas', entradasRoutes);
expressApp.use('/api/cortes', cortesRoutes);
expressApp.use('/api/dashboard', dashboardRoutes);
expressApp.use('/api/auth', authRoutes);
expressApp.use('/api/ordenes', ordenesCompraRoutes);

// =====================================
// RUTAS PROVEEDORES - IMPLEMENTACIÓN REAL SQLITE
// =====================================

// GET: Obtener todos los proveedores
expressApp.get('/api/proveedores', (req, res) => {
    try {
        db.all('SELECT * FROM proveedores ORDER BY id DESC', [], (err, rows) => {
            if (err) {
                console.error("Error SQL SELECT proveedores:", err.message);
                return res.json([]);
            }
            console.log("PROVEEDORES DESDE SQLITE:", rows);
            res.json(rows || []);
        });
    } catch (error) {
        console.error("Excepción en GET /api/proveedores:", error);
        res.json([]);
    }
});

// POST: Guardar nuevo proveedor
expressApp.post('/api/proveedores', (req, res) => {
    try {
        const { nombre, contacto, telefono, observaciones } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: "El nombre es obligatorio" });
        }
        const sql = 'INSERT INTO proveedores (nombre, contacto, telefono, observaciones) VALUES (?, ?, ?, ?)';
        db.run(sql, [nombre, contacto || '-', telefono || '-', observaciones || '-'], function(err) {
            if (err) {
                console.error("Error SQL INSERT proveedores:", err.message);
                return res.status(500).json({ error: err.message });
            }
            console.log("PROVEEDOR INSERTADO CON ID:", this.lastID);
            res.status(201).json({ id: this.lastID, nombre, contacto, telefono, observaciones });
        });
    } catch (error) {
        console.error("Excepción en POST /api/proveedores:", error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE: Eliminar proveedor
expressApp.delete('/api/proveedores/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM proveedores WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Proveedor eliminado" });
    });
});

// Servir archivos estáticos
expressApp.use(express.static(publicPath));

// Ruta principal
expressApp.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Health check para descubrimiento
expressApp.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'tienda-cvs-server', port: PORT });
});

// Iniciar servidor
const server = expressApp.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log(`Servidor corriendo en http://${localIP}:${PORT}`);
    console.log(`Modo: ${HOST === '0.0.0.0' ? 'SERVIDOR BASE (accesible desde otros dispositivos)' : 'LOCAL'}`);
    console.log(`Base path: ${basePath}`);

    // Publicar servicio en la red local via mDNS/Bonjour
    try {
        bonjour.publish({
            name: 'tienda-cvs-server',
            type: 'http',
            port: PORT,
            txt: {
                path: '/',
                version: '1.0.0'
            }
        });
        console.log('Servicio anunciado en red local como "tienda-cvs-server"');
    } catch (e) {
        console.warn('No se pudo anunciar servicio Bonjour:', e.message);
    }
});

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

module.exports = expressApp;

process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    bonjour.unpublishAll(() => {
        console.log('Servicio Bonjour despublicado');
        process.exit(0);
    });
});
