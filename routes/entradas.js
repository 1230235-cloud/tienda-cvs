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
    return `E${año}${mes}${dia}${random}`;
}

router.get('/', async (req, res) => {
    try {
        const entradas = await runQuery(`
            SELECT e.*, 
                   (SELECT COUNT(*) FROM entrada_detalles WHERE entrada_id = e.id) as num_productos
            FROM entradas e 
            ORDER BY e.fecha DESC
        `);
        res.json({ entradas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

router.post('/crear-y-entrar', verificarAdmin, async (req, res) => {
    const { codigo, nombre, categoria, precio_publico, precio_cvs, precio_compra, cantidad, stock_minimo, proveedor, usuario, observaciones } = req.body;
    
    if (!codigo || !nombre || !precio_publico || !cantidad) {
        return res.status(400).json({ error: 'Código, nombre, precio público y cantidad son requeridos' });
    }

    try {
        const precioPub = parseFloat(precio_publico) || 0;
        const precioCVS = parseFloat(precio_cvs) || precioPub;
        const pCompra = parseFloat(precio_compra) || precioPub;

        const prodResult = await runRun(`
            INSERT INTO productos (codigo, nombre, categoria, precio, precio_publico, precio_cvs, stock_bodega, stock_minimo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [codigo, nombre, categoria || 'GENERAL', precioPub, precioPub, precioCVS, parseInt(cantidad), parseInt(stock_minimo) || 5]);

        const productoId = prodResult.lastID;
        const total = parseInt(cantidad) * pCompra;
        const folio = generarFolio();

        const fechaEntrada = new Date().toISOString();

        const entradaResult = await runRun(`
            INSERT INTO entradas (folio, proveedor, total, usuario, observaciones, fecha)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [folio, proveedor || 'GENERAL', total, usuario || 'ADMIN', observaciones || 'Ingreso de producto nuevo', fechaEntrada]);

        await runRun(`
            INSERT INTO entrada_detalles (entrada_id, producto_id, cantidad, precio_compra, subtotal)
            VALUES (?, ?, ?, ?, ?)
        `, [entradaResult.lastID, productoId, parseInt(cantidad), pCompra, total]);

        const newProduct = await runGet('SELECT * FROM productos WHERE id = ?', [productoId]);

        res.status(201).json({ success: true, message: 'Producto guardado', producto: newProduct, folio, total });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'El código de producto ya existe en la tienda' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/', verificarAdmin, async (req, res) => {
    const { productos, proveedor, usuario, observaciones } = req.body;
    
    if (!productos || productos.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un producto' });
    }

    try {
        let total = 0;
        
        for (const item of productos) {
            const producto = await runGet('SELECT * FROM productos WHERE id = ?', [item.producto_id]);
            if (!producto) {
                throw new Error(`Producto con ID ${item.producto_id} no encontrado`);
            }
            total += item.cantidad * item.precio;
        }

        const folio = generarFolio();

        const fechaEntrada = new Date().toISOString();

        const entradaResult = await runRun(`
            INSERT INTO entradas (folio, proveedor, total, usuario, observaciones, fecha)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [folio, proveedor || 'GENERAL', total, usuario || 'ADMIN', observaciones || '', fechaEntrada]);

        for (const item of productos) {
            const itemSubtotal = item.cantidad * item.precio;
            
            await runRun(`
                INSERT INTO entrada_detalles (entrada_id, producto_id, cantidad, precio_compra, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [entradaResult.lastID, item.producto_id, item.cantidad, item.precio, itemSubtotal]);

            await runRun(`
                UPDATE productos 
                SET stock_bodega = stock_bodega + ?, 
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [item.cantidad, item.producto_id]);
        }

        const entrada = await runGet('SELECT * FROM entradas WHERE id = ?', [entradaResult.lastID]);
        res.status(201).json({ success: true, message: 'Entrada registrada', entrada });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/cancelar', verificarAdmin, async (req, res) => {
    try {
        const entrada = await runGet('SELECT * FROM entradas WHERE id = ?', [req.params.id]);
        if (!entrada) {
            return res.status(404).json({ error: 'Entrada no encontrada' });
        }

        const detalles = await runQuery('SELECT * FROM entrada_detalles WHERE entrada_id = ?', [req.params.id]);
        
        for (const detalle of detalles) {
            await runRun(`
                UPDATE productos 
                SET stock_bodega = stock_bodega - ?, 
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [detalle.cantidad, detalle.producto_id]);
        }

        await runRun('DELETE FROM entradas WHERE id = ?', [req.params.id]);

        res.json({ message: 'Entrada cancelada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/fecha/:fecha_inicio/:fecha_fin', async (req, res) => {
    try {
        const entradas = await runQuery(`
            SELECT * FROM entradas 
            WHERE fecha BETWEEN ? AND ?
            ORDER BY fecha DESC
        `, [req.params.fecha_inicio, req.params.fecha_fin]);
        res.json({ entradas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
