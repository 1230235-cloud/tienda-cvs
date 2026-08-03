const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper para ejecutar queries con promesas
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const rows = db.all(sql, params);
            resolve(rows);
        } catch (err) {
            reject(err);
        }
    });
}

function runGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const row = db.get(sql, params);
            resolve(row);
        } catch (err) {
            reject(err);
        }
    });
}

function runRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const result = db.run(sql, params);
            resolve({ lastID: result.lastInsertRowid, changes: result.changes });
        } catch (err) {
            reject(err);
        }
    });
}

// Generar folio único
function generarFolio() {
    const fecha = new Date();
    const año = fecha.getFullYear().toString().slice(-2);
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `E${año}${mes}${dia}${random}`;
}

// Obtener todas las entradas
router.get('/', async (req, res) => {
    try {
        const entradas = await runQuery(`
            SELECT e.*, 
                   (SELECT COUNT(*) FROM entrada_detalles WHERE entrada_id = e.id) as num_productos
            FROM entradas e 
            ORDER BY e.fecha DESC
        `);
        res.json(entradas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener una entrada por ID con detalles
router.get('/:id', async (req, res) => {
    try {
        const entrada = await runGet('SELECT * FROM entradas WHERE id = ?', [req.params.id]);
        if (!entrada) {
            return res.status(404).json({ error: 'Entrada no encontrada' });
        }
        
        const detalles = await runQuery(`
            SELECT ed.*, p.nombre, p.codigo 
            FROM entrada_detalles ed
            JOIN productos p ON ed.producto_id = p.id
            WHERE ed.entrada_id = ?
        `, [req.params.id]);
        
        res.json({ ...entrada, detalles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear un nuevo producto e ingresar su entrada de mercancía inicial
router.post('/crear-y-entrar', async (req, res) => {
    const { codigo, nombre, categoria, precio_venta, precio_compra, cantidad, stock_minimo, proveedor, usuario, observaciones } = req.body;
    
    if (!codigo || !nombre || !precio_venta || !cantidad) {
        return res.status(400).json({ error: 'Código, nombre, precio de venta y cantidad son requeridos' });
    }

    try {
        // 1. Insertar producto en la base de datos
        const prodResult = await runRun(`
            INSERT INTO productos (codigo, nombre, categoria, precio, stock, stock_minimo)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [codigo, nombre, categoria || 'GENERAL', parseFloat(precio_venta), parseInt(cantidad), parseInt(stock_minimo) || 5]);

        const productoId = prodResult.lastID;
        const pCompra = parseFloat(precio_compra) || parseFloat(precio_venta);
        const total = parseInt(cantidad) * pCompra;
        const folio = generarFolio();

        // 2. Insertar la entrada
        const entradaResult = await runRun(`
            INSERT INTO entradas (folio, proveedor, total, usuario, observaciones)
            VALUES (?, ?, ?, ?, ?)
        `, [folio, proveedor || 'GENERAL', total, usuario || 'ADMIN', observaciones || 'Ingreso de producto nuevo']);

        // 3. Insertar detalle de entrada
        await runRun(`
            INSERT INTO entrada_detalles (entrada_id, producto_id, cantidad, precio_compra, subtotal)
            VALUES (?, ?, ?, ?, ?)
        `, [entradaResult.lastID, productoId, parseInt(cantidad), pCompra, total]);

        res.json({ message: 'Producto registrado e ingresado al inventario exitosamente', productoId, folio, total });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'El código de producto ya existe en la tienda' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Crear nueva entrada
router.post('/', async (req, res) => {
    const { productos, proveedor, usuario, observaciones } = req.body;
    
    if (!productos || productos.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un producto' });
    }

    try {
        let total = 0;
        
        // Calcular total
        for (const item of productos) {
            const producto = await runGet('SELECT * FROM productos WHERE id = ?', [item.producto_id]);
            if (!producto) {
                throw new Error(`Producto con ID ${item.producto_id} no encontrado`);
            }
            total += item.cantidad * item.precio;
        }

        const folio = generarFolio();

        // Insertar entrada
        const entradaResult = await runRun(`
            INSERT INTO entradas (folio, proveedor, total, usuario, observaciones)
            VALUES (?, ?, ?, ?, ?)
        `, [folio, proveedor || 'GENERAL', total, usuario || 'ADMIN', observaciones || '']);

        // Insertar detalles y actualizar stock
        for (const item of productos) {
            const itemSubtotal = item.cantidad * item.precio;
            
            await runRun(`
                INSERT INTO entrada_detalles (entrada_id, producto_id, cantidad, precio_compra, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [entradaResult.lastID, item.producto_id, item.cantidad, item.precio, itemSubtotal]);

            // Actualizar stock sin alterar el precio de venta al público
            await runRun(`
                UPDATE productos 
                SET stock = stock + ?, 
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [item.cantidad, item.producto_id]);
        }

        res.json({ id: entradaResult.lastID, folio, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancelar entrada
router.put('/:id/cancelar', async (req, res) => {
    try {
        const entrada = await runGet('SELECT * FROM entradas WHERE id = ?', [req.params.id]);
        if (!entrada) {
            return res.status(404).json({ error: 'Entrada no encontrada' });
        }

        // Obtener detalles de la entrada
        const detalles = await runQuery('SELECT * FROM entrada_detalles WHERE entrada_id = ?', [req.params.id]);
        
        // Restar stock
        for (const detalle of detalles) {
            await runRun(`
                UPDATE productos 
                SET stock = stock - ?, fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [detalle.cantidad, detalle.producto_id]);
        }

        // Eliminar entrada (cascade eliminará los detalles)
        await runRun('DELETE FROM entradas WHERE id = ?', [req.params.id]);

        res.json({ message: 'Entrada cancelada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener entradas por fecha
router.get('/fecha/:fecha_inicio/:fecha_fin', async (req, res) => {
    try {
        const entradas = await runQuery(`
            SELECT * FROM entradas 
            WHERE fecha BETWEEN ? AND ?
            ORDER BY fecha DESC
        `, [req.params.fecha_inicio, req.params.fecha_fin]);
        res.json(entradas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
