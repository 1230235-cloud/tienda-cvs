const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper para ejecutar queries con promesas
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

// Generar folio único
function generarFolio() {
    const fecha = new Date();
    const año = fecha.getFullYear().toString().slice(-2);
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `V${año}${mes}${dia}${random}`;
}

// Obtener todas las ventas
router.get('/', async (req, res) => {
    try {
        const ventas = await runQuery(`
            SELECT v.*, 
                   (SELECT COUNT(*) FROM venta_detalles WHERE venta_id = v.id) as num_productos
            FROM ventas v 
            ORDER BY v.fecha DESC
        `);
        res.json(ventas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener una venta por ID con detalles
router.get('/:id', async (req, res) => {
    try {
        const venta = await runGet('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
        if (!venta) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        
        const detalles = await runQuery(`
            SELECT vd.*, p.nombre, p.codigo 
            FROM venta_detalles vd
            JOIN productos p ON vd.producto_id = p.id
            WHERE vd.venta_id = ?
        `, [req.params.id]);
        
        res.json({ ...venta, detalles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear nueva venta (SIN IVA)
router.post('/', async (req, res) => {
    const { productos, metodo_pago, cliente, usuario } = req.body;
    
    if (!productos || productos.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un producto' });
    }

    try {
        let total = 0;
        
        // Verificar stock y calcular total
        for (const item of productos) {
            const producto = await runGet('SELECT * FROM productos WHERE id = ?', [item.producto_id]);
            if (!producto) {
                throw new Error(`Producto con ID ${item.producto_id} no encontrado`);
            }
            if (producto.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para ${producto.nombre}`);
            }
            total += item.cantidad * item.precio_unitario;
        }

        const folio = generarFolio();

        // Insertar venta (sin IVA)
        const ventaResult = await runRun(`
            INSERT INTO ventas (folio, total, metodo_pago, cliente, usuario)
            VALUES (?, ?, ?, ?, ?)
        `, [folio, total, metodo_pago || 'EFECTIVO', cliente || 'GENERAL', usuario || 'ADMIN']);

        // Insertar detalles y actualizar stock
        for (const item of productos) {
            const itemSubtotal = item.cantidad * item.precio_unitario;
            
            await runRun(`
                INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [ventaResult.lastID, item.producto_id, item.cantidad, item.precio_unitario, itemSubtotal]);

            // Actualizar stock
            await runRun(`
                UPDATE productos 
                SET stock = stock - ?, fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [item.cantidad, item.producto_id]);
        }

        res.json({ id: ventaResult.lastID, folio, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancelar venta
router.put('/:id/cancelar', async (req, res) => {
    try {
        const venta = await runGet('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
        if (!venta) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        
        if (venta.estado === 'CANCELADA') {
            return res.status(400).json({ error: 'La venta ya está cancelada' });
        }

        // Obtener detalles de la venta
        const detalles = await runQuery('SELECT * FROM venta_detalles WHERE venta_id = ?', [req.params.id]);
        
        // Restaurar stock
        for (const detalle of detalles) {
            await runRun(`
                UPDATE productos 
                SET stock = stock + ?, fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [detalle.cantidad, detalle.producto_id]);
        }

        // Actualizar estado de venta
        await runRun('UPDATE ventas SET estado = ? WHERE id = ?', ['CANCELADA', req.params.id]);

        res.json({ message: 'Venta cancelada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener ventas por fecha
router.get('/fecha/:fecha_inicio/:fecha_fin', async (req, res) => {
    try {
        const ventas = await runQuery(`
            SELECT * FROM ventas 
            WHERE fecha BETWEEN ? AND ?
            ORDER BY fecha DESC
        `, [req.params.fecha_inicio, req.params.fecha_fin]);
        res.json(ventas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
