const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');

const isElectron = process.versions && process.versions.electron;
const dataDir = isElectron
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'SistemaInventario')
    : path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tienda.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            categoria TEXT,
            precio REAL NOT NULL,
            stock INTEGER DEFAULT 0,
            stock_minimo INTEGER DEFAULT 5,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio TEXT UNIQUE NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            total REAL NOT NULL,
            metodo_pago TEXT DEFAULT 'EFECTIVO',
            cliente TEXT DEFAULT 'GENERAL',
            usuario TEXT DEFAULT 'ADMIN',
            estado TEXT DEFAULT 'COMPLETADA'
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS venta_detalles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS entradas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio TEXT UNIQUE NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            proveedor TEXT DEFAULT 'GENERAL',
            total REAL NOT NULL,
            usuario TEXT DEFAULT 'ADMIN',
            observaciones TEXT
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS entrada_detalles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entrada_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_compra REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (entrada_id) REFERENCES entradas(id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT DEFAULT 'CAJERO',
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS cortes_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio TEXT UNIQUE NOT NULL,
            fecha_inicio DATETIME NOT NULL,
            fecha_fin DATETIME DEFAULT CURRENT_TIMESTAMP,
            ventas_efectivo REAL DEFAULT 0,
            ventas_tarjeta REAL DEFAULT 0,
            ventas_transferencia REAL DEFAULT 0,
            total_ventas REAL DEFAULT 0,
            efectivo_inicial REAL DEFAULT 0,
            efectivo_final REAL DEFAULT 0,
            diferencia REAL DEFAULT 0,
            usuario TEXT DEFAULT 'ADMIN',
            estado TEXT DEFAULT 'CERRADO'
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS movimientos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            monto REAL NOT NULL,
            descripcion TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            usuario TEXT DEFAULT 'ADMIN',
            corte_id INTEGER,
            FOREIGN KEY (corte_id) REFERENCES cortes_caja(id)
        )
    `);

    const count = db.get('SELECT COUNT(*) as count FROM usuarios');
    if (count && count.count === 0) {
        const adminPass = bcrypt.hashSync('admin123', 10);
        const cajeroPass = bcrypt.hashSync('123456', 10);
        const stmt = db.prepare('INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)');
        stmt.run('admin', adminPass, 'Administrador Tienda CVS', 'ADMIN');
        stmt.run('cajero', cajeroPass, 'Cajero Tienda CVS', 'CAJERO');
        stmt.finalize();
        console.log('Usuarios iniciales creados (admin/admin123, cajero/123456)');
    }

    const productosCount = db.get('SELECT COUNT(*) as count FROM productos');
    if (productosCount && productosCount.count === 0) {
        const productosPrueba = [
            ['750100000001', 'Coca-Cola Original 600ml', 'Bebidas', 18.00, 45, 10],
            ['750100000002', 'Sabritas Saladas 45g', 'Botanas', 22.00, 30, 8],
            ['750100000003', 'Agua Ciel Purificada 1L', 'Bebidas', 12.00, 60, 15],
            ['750100000004', 'Leche Lala Entera 1L', 'Lácteos', 27.50, 24, 6],
            ['750100000005', 'Pan Blanco Bimbo Grande', 'Abarrotes', 48.00, 15, 5],
            ['750100000006', 'Galletas Chokis 76g', 'Galletas', 20.00, 35, 10],
            ['750100000007', 'Chocolate Carlos V 18g', 'Dulces', 12.50, 50, 12],
            ['750100000008', 'Café Nescafé Clásico 120g', 'Abarrotes', 75.00, 18, 5],
            ['750100000009', 'Detergente Ariel 1kg', 'Limpieza', 45.00, 12, 4],
            ['750100000010', 'Jabón Zote Blanco 400g', 'Limpieza', 25.00, 20, 5],
            ['750100000011', 'Aceite Capullo 840ml', 'Abarrotes', 52.00, 14, 4],
            ['750100000012', 'Arroz Verde Valle 1kg', 'Abarrotes', 34.00, 22, 6],
            ['750100000013', 'Frijol Negro Isadora 430g', 'Abarrotes', 23.00, 28, 8],
            ['750100000014', 'Atún Herdez en Agua 130g', 'Enlatados', 21.50, 40, 10],
            ['750100000015', 'Refresco Jarrito Manzana 2L', 'Bebidas', 26.00, 20, 5],
            ['750100000016', 'Cheetos Torciditos 55g', 'Botanas', 19.50, 3, 10],
            ['750100000017', 'Red Bull Energy Drink 250ml', 'Bebidas', 45.00, 2, 5],
            ['750100000018', 'Servilletas Pétalo 100pzs', 'Hogar', 28.00, 25, 6]
        ];

        const stmt = db.prepare('INSERT INTO productos (codigo, nombre, categoria, precio, stock, stock_minimo) VALUES (?, ?, ?, ?, ?, ?)');
        productosPrueba.forEach(p => stmt.run(p));
        stmt.finalize();
        console.log('Productos de prueba iniciales cargados para Tienda CVS');
    }

    console.log('Base de datos inicializada correctamente en:', dbPath);
}

module.exports = db;
