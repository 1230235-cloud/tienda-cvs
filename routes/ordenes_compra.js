const express = require('express');
const router = express.Router();
const { runGet, runRun, runQuery } = require('../database');
const { verificarAdmin } = require('../middleware');

router.get('/proveedores', async (req, res) => {
    try {
        const proveedores = await runQuery(`
            SELECT DISTINCT proveedor FROM productos 
            WHERE proveedor IS NOT NULL 
            AND proveedor != '' 
            AND (stock_bodega + stock_tienda) <= stock_minimo 
            AND activo = 1
            ORDER BY proveedor
        `);
        res.json({ proveedores });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/productos-bajo-stock', async (req, res) => {
    try {
        const productos = await runQuery(`
            SELECT id, codigo, nombre, categoria, precio_publico, precio_cvs, 
                   stock_bodega, stock_tienda, stock_minimo, proveedor,
                   (stock_bodega + stock_tienda) as stock_total
            FROM productos 
            WHERE activo = 1 
            AND (stock_bodega + stock_tienda) <= stock_minimo
            ORDER BY proveedor, stock_total ASC
        `);
        res.json({ productos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/productos-bajo-stock-proveedor', async (req, res) => {
    try {
        const { proveedor } = req.query;
        if (!proveedor) {
            return res.json({ productos: [] });
        }
        const productos = await runQuery(`
            SELECT id, codigo, nombre, categoria, precio_publico, precio_cvs,
                   stock_bodega, stock_tienda, stock_minimo, proveedor,
                   (stock_bodega + stock_tienda) as stock_total
            FROM productos 
            WHERE activo = 1 
            AND proveedor = ?
            AND (stock_bodega + stock_tienda) <= stock_minimo
            ORDER BY stock_total ASC
        `, [proveedor]);
        res.json({ productos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const ordenes = await runQuery('SELECT * FROM ordenes_compra ORDER BY fecha DESC');
        res.json({ ordenes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const orden = await runGet('SELECT * FROM ordenes_compra WHERE id = ?', [req.params.id]);
        if (!orden) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        const detalles = await runQuery('SELECT * FROM orden_compra_detalles WHERE orden_id = ?', [req.params.id]);
        res.json({ orden, detalles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', verificarAdmin, async (req, res) => {
    try {
        const { proveedor, solicita, autoriza, detalles } = req.body;

        if (!proveedor || !proveedor.trim()) {
            return res.status(400).json({ error: 'Debe proporcionar un proveedor' });
        }

        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ error: 'Debe incluir al menos un producto en la orden' });
        }

        let total = 0;
        for (const d of detalles) {
            const cantidad = parseInt(d.cantidad) || 0;
            const costo = parseFloat(d.costo) || 0;
            total += cantidad * costo;
        }

        const result = await runRun(
            'INSERT INTO ordenes_compra (proveedor, solicita, autoriza, total) VALUES (?, ?, ?, ?)',
            [proveedor.trim(), solicita || '', autoriza || '', total]
        );

        const ordenId = result.lastID;

        for (const d of detalles) {
            const cantidad = parseInt(d.cantidad) || 0;
            const costo = parseFloat(d.costo) || 0;
            const subtotal = cantidad * costo;
            const descripcion = d.descripcion || '';
            const productoId = d.producto_id || null;

            await runRun(
                'INSERT INTO orden_compra_detalles (orden_id, producto_id, descripcion, cantidad, costo, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [ordenId, productoId, descripcion, cantidad, costo, subtotal]
            );
        }

        res.status(201).json({ mensaje: 'Orden de compra creada', ordenId, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/estado', verificarAdmin, async (req, res) => {
    try {
        const { estado } = req.body;
        const validEstados = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'RECIBIDA', 'CERRADA'];

        if (!estado || !validEstados.includes(estado)) {
            return res.status(400).json({ error: `Estado inválido. Estados válidos: ${validEstados.join(', ')}` });
        }

        await runRun('UPDATE ordenes_compra SET estado = ? WHERE id = ?', [estado, req.params.id]);
        res.json({ mensaje: 'Estado actualizado', ordenId: req.params.id, estado });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    try {
        await runRun('DELETE FROM ordenes_compra WHERE id = ?', [req.params.id]);
        res.json({ mensaje: 'Orden eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;