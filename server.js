const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./database');
const bonjour = require('bonjour')();
const { queryAll, queryRun } = require('./database');

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
expressApp.get('/api/proveedores', async (req, res) => {
    try {
        const rows = await queryAll('SELECT * FROM proveedores ORDER BY id DESC');
        res.json(rows || []);
    } catch (err) {
        console.error("Error en GET /api/proveedores:", err.message);
        res.json([]);
    }
});

// POST: Guardar nuevo proveedor
expressApp.post('/api/proveedores', async (req, res) => {
    try {
        const { nombre, contacto, telefono, observaciones } = req.body;
        if (!nombre) {
            return res.status(400).json({ error: "El nombre es obligatorio" });
        }
        const result = await queryRun(
            'INSERT INTO proveedores (nombre, contacto, telefono, observaciones) VALUES (?, ?, ?, ?)',
            [nombre, contacto || '-', telefono || '-', observaciones || '-']
        );
        res.status(201).json({ id: result?.lastInsertRowid || result?.lastID || Date.now(), nombre, contacto, telefono, observaciones });
    } catch (err) {
        console.error("Error en POST /api/proveedores:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Eliminar proveedor
expressApp.delete('/api/proveedores/:id', async (req, res) => {
    try {
        await queryRun('DELETE FROM proveedores WHERE id = ?', [req.params.id]);
        res.json({ message: "Proveedor eliminado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================================
// PRODUCTOS POR PROVEEDOR
// =====================================

// GET: Obtener productos filtrados por proveedor (directo o por historial de entradas)
expressApp.get('/api/productos-por-proveedor', async (req, res) => {
    try {
        const { proveedor } = req.query;
        if (!proveedor || proveedor === 'todos') {
            const todos = await queryAll('SELECT * FROM productos');
            return res.json(todos || []);
        }

        const sql = `
            SELECT DISTINCT p.*
            FROM productos p
            LEFT JOIN entrada_detalles de ON p.id = de.producto_id
            LEFT JOIN entradas e ON de.entrada_id = e.id
            WHERE LOWER(p.proveedor) = LOWER(?)
               OR LOWER(e.proveedor) = LOWER(?)
               OR LOWER(p.nombre_proveedor) = LOWER(?)
        `;
        const productos = await queryAll(sql, [proveedor, proveedor, proveedor]);
        res.json(productos || []);
    } catch (err) {
        console.error("Error al obtener productos por proveedor:", err);
        res.status(500).json([]);
    }
});

// Servir archivos estáticos del frontend
expressApp.use(express.static(publicPath));
expressApp.use(express.static(__dirname));

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
