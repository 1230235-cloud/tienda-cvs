const express = require('express');
const router = express.Router();
const { runGet, runRun, runQuery } = require('../database');
const { verificarAdmin } = require('../middleware');

router.get('/', async (req, res) => {
    try {
        const productos = await runQuery('SELECT id, codigo, nombre, categoria, precio, precio_publico, precio_cvs, stock_bodega, stock_tienda, activo FROM productos WHERE activo = 1 ORDER BY nombre');
        res.json({ productos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const producto = await runGet('SELECT * FROM productos WHERE id = ? AND activo = 1', [req.params.id]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/codigo/:codigo', async (req, res) => {
    try {
        const producto = await runGet('SELECT * FROM productos WHERE codigo = ? AND activo = 1', [req.params.codigo]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', verificarAdmin, async (req, res) => {
    return res.status(403).json({ error: 'No se pueden crear productos desde inventario. Use el módulo de Entradas de Mercancía para agregar nuevos productos.' });
});

router.put('/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const producto = await runGet('SELECT * FROM productos WHERE id = ?', [id]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const { nombre, codigo, categoria, precio, precio_publico, precio_cvs, stock_minimo, proveedor } = req.body;

        await runRun(`
            UPDATE productos SET
                nombre = ?,
                codigo = ?,
                categoria = ?,
                precio = ?,
                precio_publico = ?,
                precio_cvs = ?,
                stock_minimo = ?,
                proveedor = ?,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            nombre || producto.nombre,
            codigo || producto.codigo,
            categoria || producto.categoria,
            precio ?? producto.precio,
            precio_publico ?? producto.precio_publico,
            precio_cvs ?? producto.precio_cvs,
            stock_minimo ?? producto.stock_minimo,
            proveedor ?? producto.proveedor,
            id
        ]);

        const actualizado = await runGet('SELECT * FROM productos WHERE id = ?', [id]);
        res.json(actualizado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const producto = await runGet('SELECT * FROM productos WHERE id = ?', [id]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        if (!producto.activo) {
            return res.status(400).json({ error: 'El producto ya está desactivado' });
        }
        
        await runRun('UPDATE productos SET activo = 0, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        res.json({ mensaje: 'Producto desactivado correctamente del inventario' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/alertas/stock-bajo', async (req, res) => {
    try {
        const productos = await runQuery('SELECT * FROM productos WHERE (stock_bodega + stock_tienda) <= stock_minimo AND activo = 1');
        res.json({ productos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/traspaso', verificarAdmin, async (req, res) => {
    try {
        const { producto_id, cantidad } = req.body;
        
        if (!producto_id || !cantidad || cantidad <= 0) {
            return res.status(400).json({ error: 'Debe proporcionar un producto_id y una cantidad válida' });
        }
        
        const producto = await runGet('SELECT * FROM productos WHERE id = ?', [producto_id]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        if (producto.stock_bodega < cantidad) {
            return res.status(400).json({ error: `Stock insuficiente en bodega. Disponible: ${producto.stock_bodega}, Solicitado: ${cantidad}` });
        }
        
        await runRun('UPDATE productos SET stock_bodega = stock_bodega - ?, stock_tienda = stock_tienda + ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?', [cantidad, cantidad, producto_id]);
        
        res.json({ mensaje: 'Traspaso realizado correctamente', producto_id, cantidad });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/agregar-stock-bodega', verificarAdmin, async (req, res) => {
    try {
        const { producto_id, cantidad } = req.body;
        
        if (!producto_id || !cantidad || cantidad <= 0) {
            return res.status(400).json({ error: 'Debe proporcionar un producto_id y una cantidad válida' });
        }
        
        const producto = await runGet('SELECT * FROM productos WHERE id = ?', [producto_id]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        await runRun('UPDATE productos SET stock_bodega = stock_bodega + ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?', [parseInt(cantidad), producto_id]);
        
        res.json({ mensaje: 'Stock agregado a bodega correctamente', producto_id, cantidad });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
