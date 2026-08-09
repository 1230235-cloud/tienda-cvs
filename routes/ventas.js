const express = require('express');
const router = express.Router();
const { runGet, runRun, runQuery } = require('../database');
const { verificarAdmin } = require('../middleware');

function generarFolio() {
    const fecha = new Date();
    const año = fecha.getFullYear().toString().slice(-2);
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `V${año}${mes}${dia}${random}`;
}

router.get('/', async (req, res) => {
    try {
        const ventas = await runQuery(`
            SELECT v.*, 
                   (SELECT COUNT(*) FROM venta_detalles WHERE venta_id = v.id) as num_productos
            FROM ventas v 
            ORDER BY v.id DESC
            LIMIT 100
        `);
        res.json({ ventas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:parametro', async (req, res) => {
    try {
        const { parametro } = req.params;
        const venta = await runQuery('SELECT * FROM ventas WHERE folio = ? OR id = ? OR ticket_num = ?', [parametro, parametro, parametro]);
        if (!venta || venta.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada con el folio o ID ingresado' });
        }

        const detalles = await runQuery(`
            SELECT vd.*, p.nombre, p.codigo 
            FROM venta_detalles vd
            JOIN productos p ON vd.producto_id = p.id
            WHERE vd.venta_id = ?
        `, [venta[0].id]);

        res.json({ ...venta[0], detalles });
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar la venta' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { productos, cliente, tipo_cliente, metodoPago, metodo_pago, pagoCon, pago_con, cambio, total, precio_final } = req.body;

        if (!productos || !Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío' });
        }

        const metodo = metodoPago || metodo_pago || 'EFECTIVO';
        let totalVenta = total || 0;

        for (const item of productos) {
            const producto = await runGet('SELECT * FROM productos WHERE id = ?', [item.producto_id]);
            if (!producto) {
                return res.status(400).json({ error: `Producto con ID ${item.producto_id} no encontrado` });
            }
            if (producto.stock_tienda < item.cantidad) {
                return res.status(400).json({ error: `Stock insuficiente para ${producto.nombre}` });
            }
            const precio = item.precio_unitario || item.precio || producto.precio;
            totalVenta += item.cantidad * precio;
        }

        let corteId = null;
        try {
            const corteAbierto = await runGet("SELECT id FROM cortes_caja WHERE estado = 'ABIERTO' LIMIT 1");
            if (corteAbierto) {
                corteId = corteAbierto.id;
            }
        } catch (corteErr) {
            console.warn('No se pudo obtener corte activo, continuando sin corte_id:', corteErr.message);
        }

        const pago = parseFloat(pagoCon || pago_con) || totalVenta;
        const cambioCalculado = parseFloat(cambio) || 0;
        const clienteNombre = cliente || 'PÚBLICO GENERAL';
        const usuarioNombre = req.body.usuario || 'ADMIN';

        const fechaVenta = new Date().toISOString();

        const folio = generarFolio();

        const ventaResult = await runRun(`
            INSERT INTO ventas (folio, total, metodo_pago, cliente, tipo_cliente, precio_final, usuario, corte_id, fecha)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [folio, totalVenta, metodo, clienteNombre, tipo_cliente || 'PUBLICO', precio_final || totalVenta, usuarioNombre, corteId, fechaVenta]);

        for (const item of productos) {
            const producto = await runGet('SELECT * FROM productos WHERE id = ?', [item.producto_id]);
            const precio = item.precio_unitario || item.precio || (producto ? producto.precio : 0);
            const itemSubtotal = item.cantidad * precio;

            await runRun(`
                INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [ventaResult.lastID, item.producto_id, item.cantidad, precio, itemSubtotal]);
await runRun(`
                UPDATE productos 
                SET stock_tienda = stock_tienda - ?, 
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [item.cantidad, item.producto_id]);
        }

        res.status(201).json({
            success: true,
            ventaId: ventaResult.lastID,
            folio: String(ventaResult.lastID),
            total: totalVenta,
            metodoPago: metodo,
            pagoCon: pago,
            cambio: cambioCalculado
        });
    } catch (error) {
        console.error('Error en POST /api/ventas:', error);
        res.status(500).json({ error: 'Error del servidor: ' + error.message });
    }
});

router.put('/:id/cancelar', verificarAdmin, async (req, res) => {
    try {
        const venta = await runGet('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
        if (!venta) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        
        if (venta.estado === 'CANCELADA') {
            return res.status(400).json({ error: 'La venta ya está cancelada' });
        }

        const detalles = await runQuery('SELECT * FROM venta_detalles WHERE venta_id = ?', [req.params.id]);
        
        for (const detalle of detalles) {
            await runRun(`
                UPDATE productos 
                SET stock_tienda = stock_tienda + ?, 
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [detalle.cantidad, detalle.producto_id]);
        }

        await runRun('UPDATE ventas SET estado = ? WHERE id = ?', ['CANCELADA', req.params.id]);

        res.json({ message: 'Venta cancelada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/fecha/:fecha_inicio/:fecha_fin', async (req, res) => {
    try {
        const ventas = await runQuery(`
            SELECT * FROM ventas 
            WHERE fecha BETWEEN ? AND ?
            ORDER BY fecha DESC
        `, [req.params.fecha_inicio, req.params.fecha_fin]);
        res.json({ ventas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
