const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const userDataPath = process.env.USER_DATA_PATH || process.env.TIENDA_DATA_DIR || process.env.APPDATA || path.join(__dirname, 'data');

if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

const dbPath = path.join(userDataPath, 'database.sqlite');

console.log('RUTA ÚNICA DE BASE DE DATOS:', dbPath);
console.log('DB file exists before open:', fs.existsSync(dbPath));

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error abriendo la base de datos:', err.message);
        throw err;
    }
    console.log('SQLite conexion OK en:', dbPath);
});

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function runGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function runRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function exec(sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function initializeDatabase() {
    try {
        await exec('SELECT 1');
    } catch (e) {
        console.warn('Error de conexión BD, intentando recuperación...', e.message);
        try {
            db.close();
        } catch (e) {
            // Ignorar
        }
        const fs = require('fs');
        const path = require('path');
        const userDataPath = process.env.USER_DATA_PATH || process.env.TIENDA_DATA_DIR || path.join(__dirname, 'data');
        const dbPath = path.join(userDataPath, 'database.sqlite');
        try {
            if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
                console.log('BD eliminada, se recreará al reiniciar');
            }
        } catch (e) {
            console.error('No se pudo eliminar BD corrupta:', e.message);
        }
        console.log('Reinicia la aplicación para generar una nueva base de datos limpia.');
        throw new Error('Base de datos corrupta. Por favor reinicia la aplicación.');
    }
    await exec(`
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            categoria TEXT,
            precio REAL NOT NULL,
            precio_publico REAL NOT NULL,
            precio_cvs REAL NOT NULL,
            stock_bodega INTEGER DEFAULT 0,
            stock_tienda INTEGER DEFAULT 0,
            stock_minimo INTEGER DEFAULT 5,
            activo INTEGER DEFAULT 1,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await exec(`
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio TEXT UNIQUE NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            total REAL NOT NULL,
            metodo_pago TEXT DEFAULT 'EFECTIVO',
            cliente TEXT DEFAULT 'GENERAL',
            tipo_cliente TEXT DEFAULT 'PUBLICO',
            precio_final REAL DEFAULT 0,
            usuario TEXT DEFAULT 'ADMIN',
            corte_id INTEGER DEFAULT NULL,
            estado TEXT DEFAULT 'COMPLETADA',
            FOREIGN KEY (corte_id) REFERENCES cortes_caja(id)
        )
    `);

    await exec(`
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

    await exec(`
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

    await exec(`
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

    await exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT DEFAULT 'CAJERO',
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await exec(`
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

    await exec(`
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

    // Migración: agregar corte_id a ventas si no existe
    try {
        await exec('ALTER TABLE ventas ADD COLUMN corte_id INTEGER DEFAULT NULL');
        console.log('Migración aplicada: columna corte_id agregada a ventas');
    } catch (e) {
        // La columna ya existe o no se puede agregar, ignorar
    }

    // Migración: agregar activo a productos si no existe
    try {
        await exec('ALTER TABLE productos ADD COLUMN activo INTEGER DEFAULT 1');
        console.log('Migración aplicada: columna activo agregada a productos');
    } catch (e) {
        // La columna ya existe o no se puede agregar, ignorar
    }

    // Migración: agregar stock_bodega y stock_tienda, migrar stock existente
    try {
        await exec('ALTER TABLE productos ADD COLUMN stock_bodega INTEGER DEFAULT 0');
        console.log('Migración aplicada: columna stock_bodega agregada a productos');
    } catch (e) {
        // La columna ya existe o no se puede agregar, ignorar
    }

    try {
        await exec('ALTER TABLE productos ADD COLUMN stock_tienda INTEGER DEFAULT 0');
        console.log('Migración aplicada: columna stock_tienda agregada a productos');
    } catch (e) {
        // La columna ya existe o no se puede agregar, ignorar
    }

    // Migrar stock existente a stock_bodega y limpiar stock
    try {
        await exec('UPDATE productos SET stock_bodega = stock, stock_tienda = 0 WHERE stock > 0');
        console.log('Migración aplicada: stock migrado a stock_bodega');
    } catch (e) {
        // Ignorar errores de migración
    }

    // Migración: agregar proveedor a productos si no existe
    try {
        await exec('ALTER TABLE productos ADD COLUMN proveedor TEXT DEFAULT NULL');
        console.log('Migración aplicada: columna proveedor agregada a productos');
    } catch (e) {
        // La columna ya existe o no se puede agregar, ignorar
    }

    // Migración: agregar tipo_cliente a ventas si no existe
    try {
        await exec('ALTER TABLE ventas ADD COLUMN tipo_cliente TEXT DEFAULT PUBLICO');
        console.log('Migración aplicada: columna tipo_cliente agregada a ventas');
    } catch (e) {
        // La columna ya existe o no se puede agregar, ignorar
    }

    // Migración: agregar precio_final a ventas si no existe
    try {
        await exec('ALTER TABLE ventas ADD COLUMN precio_final REAL DEFAULT 0');
        console.log('Migración aplicada: columna precio_final agregada a ventas');
    } catch (e) {
        // La columna ya existe o no se puede agregar, ignorar
    }

    // Migración: agregar precios diferenciados a productos si no existen
    try {
        await exec('ALTER TABLE productos ADD COLUMN precio_publico REAL DEFAULT 0');
        await exec('ALTER TABLE productos ADD COLUMN precio_cvs REAL DEFAULT 0');
        console.log('Migración aplicada: columnas precio_publico y precio_cvs agregadas a productos');
    } catch (e) {
        // Las columnas ya existen o no se pueden agregar, ignorar
    }

    // Crear tabla de proveedores si no existe
    try {
        await exec(`
            CREATE TABLE IF NOT EXISTS proveedores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                contacto TEXT DEFAULT '-',
                telefono TEXT DEFAULT '-',
                observaciones TEXT DEFAULT '-',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Tabla proveedores lista y verificada.");
    } catch (err) {
        console.error("Error creando tabla proveedores:", err);
    }

    // Crear tabla de órdenes de compra
    await exec(`
        CREATE TABLE IF NOT EXISTS ordenes_compra (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proveedor TEXT NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            estado TEXT DEFAULT 'PENDIENTE',
            solicita TEXT DEFAULT '',
            autoriza TEXT DEFAULT '',
            total REAL DEFAULT 0
        )
    `);
    console.log('Tabla ordenes_compra lista');

    // Crear tabla de detalles de órdenes de compra
    await exec(`
        CREATE TABLE IF NOT EXISTS orden_compra_detalles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_id INTEGER NOT NULL,
            producto_id INTEGER,
            descripcion TEXT NOT NULL,
            cantidad INTEGER NOT NULL,
            costo REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (orden_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
    `);
    console.log('Tabla orden_compra_detalles lista');

    const adminPass = bcrypt.hashSync('admin123', 10);
    const cajeroPass = bcrypt.hashSync('123456', 10);
    await runRun('INSERT OR IGNORE INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)', ['admin', adminPass, 'Administrador Tienda CVS', 'ADMIN']);
    await runRun('INSERT OR IGNORE INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)', ['cajero', cajeroPass, 'Cajero Tienda CVS', 'CAJERO']);
    console.log('Usuarios iniciales creados (admin/admin123, cajero/123456)');

    const productosCount = await runGet('SELECT COUNT(*) as count FROM productos');
    if (productosCount && productosCount.count === 0) {
        const productosPrueba = [
            ['750100000001', 'Coca-Cola Original 600ml', 'Bebidas', 18.00, 18.00, 20.00, 45, 10],
            ['750100000002', 'Sabritas Saladas 45g', 'Botanas', 22.00, 22.00, 25.00, 30, 8],
            ['750100000003', 'Agua Ciel Purificada 1L', 'Bebidas', 12.00, 12.00, 15.00, 60, 15],
            ['750100000004', 'Leche Lala Entera 1L', 'Lácteos', 27.50, 27.50, 30.00, 24, 6],
            ['750100000005', 'Pan Blanco Bimbo Grande', 'Abarrotes', 48.00, 48.00, 52.00, 15, 5],
            ['750100000006', 'Galletas Chokis 76g', 'Galletas', 20.00, 20.00, 22.00, 35, 10],
            ['750100000007', 'Chocolate Carlos V 18g', 'Dulces', 12.50, 12.50, 15.00, 50, 12],
            ['750100000008', 'Café Nescafé Clásico 120g', 'Abarrotes', 75.00, 75.00, 80.00, 18, 5],
            ['750100000009', 'Detergente Ariel 1kg', 'Limpieza', 45.00, 45.00, 50.00, 12, 4],
            ['750100000010', 'Jabón Zote Blanco 400g', 'Limpieza', 25.00, 25.00, 28.00, 20, 5],
            ['750100000011', 'Aceite Capullo 840ml', 'Abarrotes', 52.00, 52.00, 55.00, 14, 4],
            ['750100000012', 'Arroz Verde Valle 1kg', 'Abarrotes', 34.00, 34.00, 38.00, 22, 6],
            ['750100000013', 'Frijol Negro Isadora 430g', 'Abarrotes', 23.00, 23.00, 25.00, 28, 8],
            ['750100000014', 'Atún Herdez en Agua 130g', 'Enlatados', 21.50, 21.50, 24.00, 40, 10],
            ['750100000015', 'Refresco Jarrito Manzana 2L', 'Bebidas', 26.00, 26.00, 28.00, 20, 5],
            ['750100000016', 'Cheetos Torciditos 55g', 'Botanas', 19.50, 19.50, 22.00, 3, 10],
            ['750100000017', 'Red Bull Energy Drink 250ml', 'Bebidas', 45.00, 45.00, 50.00, 2, 5],
            ['750100000018', 'Servilletas Pétalo 100pzs', 'Hogar', 28.00, 28.00, 30.00, 25, 6]
        ];

        for (const p of productosPrueba) {
            await db.run('INSERT INTO productos (codigo, nombre, categoria, precio, precio_publico, precio_cvs, stock, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', p);
        }
        console.log('Productos de prueba iniciales cargados para Tienda CVS');
    }

    console.log('Base de datos inicializada correctamente en:', dbPath);
    
    const usuariosActuales = await runQuery('SELECT id, username, nombre, rol FROM usuarios');
    console.log('Usuarios en la base de datos:', JSON.stringify(usuariosActuales, null, 2));
}

db.initializeDatabase = initializeDatabase;

module.exports = { db, runQuery, runGet, runRun, exec, initializeDatabase };
