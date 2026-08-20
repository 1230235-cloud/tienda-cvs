const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
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

// GET: Obtener proveedor por ID (para editar)
expressApp.get('/api/proveedores/:id', async (req, res) => {
    try {
        const rows = await queryAll('SELECT * FROM proveedores WHERE id = ?', [req.params.id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error("Error en GET /api/proveedores/:id:", err.message);
        res.status(500).json({ error: 'Error al obtener proveedor' });
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
        try {
            await queryRun('UPDATE proveedores SET activo = 0 WHERE id = ?', [req.params.id]);
            res.json({ message: "Proveedor desactivado (tenía productos asociados)" });
        } catch (innerErr) {
            console.error("Error en DELETE /api/proveedores:", innerErr.message);
            res.status(500).json({ error: 'No se pudo eliminar el proveedor' });
        }
    }
});

// =====================================
// GESTIÓN DE USUARIOS - IMPLEMENTACIÓN DIRECTA
// =====================================

// POST: Crear usuario con manejo de errores robusto
expressApp.post('/api/usuarios', async (req, res) => {
    try {
        const { nombre, usuario, password, rol } = req.body;

        if (!usuario || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        const existe = await queryAll('SELECT id FROM usuarios WHERE username = ?', [usuario]);
        if (existe && existe.length > 0) {
            return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await queryRun(
            'INSERT INTO usuarios (nombre, username, password, rol, activo) VALUES (?, ?, ?, ?, 1)',
            [nombre || usuario, usuario, hashedPassword, rol || 'Usuario']
        );

        return res.status(201).json({ success: true, message: 'Usuario creado exitosamente' });
    } catch (err) {
        console.error("Error al crear usuario:", err);
        return res.status(500).json({ error: 'Error interno del servidor al crear el usuario: ' + err.message });
    }
});

// =====================================
// PRODUCTOS POR PROVEEDOR
// =====================================

// GET: Obtener productos filtrados por proveedor (directo o por historial de entradas)
expressApp.get('/api/productos-por-proveedor', async (req, res) => {
    try {
        const { proveedor, proveedor_id } = req.query;

        if ((!proveedor || proveedor === 'todos') && (!proveedor_id)) {
            const todos = await queryAll('SELECT * FROM productos');
            return res.json(todos || []);
        }

        let productos = [];
        let proveedorIdFinal = null;

        if (proveedor_id) {
            const proveedorRow = await queryAll('SELECT id, nombre FROM proveedores WHERE id = ?', [proveedor_id]);
            const nombreProveedor = proveedorRow && proveedorRow.length > 0 ? proveedorRow[0].nombre : null;
            proveedorIdFinal = proveedorRow && proveedorRow.length > 0 ? proveedorRow[0].id : null;

            if (nombreProveedor) {
                productos = await queryAll(`
                    SELECT DISTINCT p.*
                    FROM productos p
                    WHERE LOWER(p.proveedor) = LOWER(?)
                       OR LOWER(p.nombre_proveedor) = LOWER(?)
                `, [nombreProveedor, nombreProveedor]);
            }
        } else if (proveedor) {
            const proveedorRow = await queryAll('SELECT id FROM proveedores WHERE LOWER(nombre) = LOWER(?)', [proveedor]);
            proveedorIdFinal = proveedorRow && proveedorRow.length > 0 ? proveedorRow[0].id : null;

            const sql = `
                SELECT DISTINCT p.*
                FROM productos p
                LEFT JOIN entrada_detalles de ON p.id = de.producto_id
                LEFT JOIN entradas e ON de.entrada_id = e.id
                WHERE LOWER(p.proveedor) = LOWER(?)
                   OR LOWER(e.proveedor) = LOWER(?)
                   OR LOWER(p.nombre_proveedor) = LOWER(?)
            `;
            productos = await queryAll(sql, [proveedor, proveedor, proveedor]);
        }

        const productosConProveedorId = productos.map(p => ({
            ...p,
            proveedor_id: proveedorIdFinal
        }));

        res.json(productosConProveedorId || []);
    } catch (err) {
        console.error("Error al obtener productos por proveedor:", err);
        res.status(500).json([]);
    }
});

// Servir archivos estáticos del frontend
expressApp.use(express.static(publicPath));
expressApp.use(express.static(__dirname));

// Ruta principal - servir el dashboard del sistema
expressApp.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'dashboard.html'));
});

// Health check para descubrimiento
expressApp.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'tienda-cvs-server', port: PORT });
});

// Middleware global de errores (debe ir después de todas las rutas)
expressApp.use((err, req, res, next) => {
    console.error("Uncaught Error:", err);
    res.status(500).json({ error: 'Error inesperado en el servidor' });
});

process.on('uncaughtException', (err) => {
    console.error('Excepción no capturada:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no capturada:', reason);
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
