const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const userDataPath = process.env.USER_DATA_PATH || process.env.TIENDA_DATA_DIR || path.join(__dirname, 'data');
const dbPath = path.join(userDataPath, 'database.sqlite');

if (!fs.existsSync(dbPath)) {
    console.log('No se encontró base de datos en:', dbPath);
    console.log('La base de datos se creará automáticamente al iniciar la aplicación.');
    process.exit(0);
}

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err.message);
        process.exit(1);
    }
});

async function resetDatabase() {
    console.log('Reiniciando base de datos...');
    console.log('Base de datos:', dbPath);

    const tables = [
        'ventas',
        'venta_detalles',
        'productos',
        'cortes_caja',
        'entradas',
        'ordenes_compra',
        'orden_compra_detalles'
    ];

    for (const table of tables) {
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM ${table}`, (err) => {
                if (err) {
                    console.warn(`Advertencia al limpiar ${table}:`, err.message);
                } else {
                    console.log(`  Tabla ${table} limpia.`);
                }
                resolve();
            });
        });
    }

    await new Promise((resolve, reject) => {
        db.run("DELETE FROM sqlite_sequence WHERE name IN ('ventas', 'venta_detalles', 'productos', 'cortes_caja', 'entradas', 'ordenes_compra', 'orden_compra_detalles')", (err) => {
            if (err) {
                console.warn('Advertencia al reiniciar secuencias:', err.message);
            } else {
                console.log('  Secuencias de autoincremento reiniciadas.');
            }
            resolve();
        });
    });

    const userCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM usuarios', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });

    console.log(`  Usuarios preservados: ${userCount}`);

    db.close();
    console.log('Base de datos reiniciada correctamente.');
}

resetDatabase().catch((err) => {
    console.error('Error al reiniciar la base de datos:', err.message);
    process.exit(1);
});