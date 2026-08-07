const express = require('express');
const router = express.Router();
const { runGet, runQuery } = require('../database');
const { verificarAdmin } = require('../middleware');

router.get('/estadisticas', verificarAdmin, async (req, res) => {
    try {
        const totalProductosResult = await runGet('SELECT COUNT(*) as total FROM productos WHERE activo = 1');
        const totalProductos = totalProductosResult.total;
        
        const stockBajoResult = await runGet('SELECT COUNT(*) as total FROM productos WHERE (stock_bodega + stock_tienda) <= stock_minimo AND activo = 1');
        const stockBajo = stockBajoResult.total;
        
        const valorInventarioResult = await runGet('SELECT SUM(precio * (stock_bodega + stock_tienda)) as total FROM productos WHERE activo = 1');
        const valorInventario = valorInventarioResult.total || 0;
        
        const hoy = new Date().toISOString().split('T')[0];
        const inicioHoy = new Date(hoy + 'T00:00:00.000Z').toISOString();
        const finHoy = new Date(hoy + 'T23:59:59.999Z').toISOString();
        const ventasHoy = await runGet(`
            SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto 
            FROM ventas 
            WHERE fecha >= ? AND fecha <= ? AND estado = 'COMPLETADA'
        `, [inicioHoy, finHoy]);
        
        const ahora = new Date();
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
        const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        const ventasMes = await runGet(`
            SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto 
            FROM ventas 
            WHERE fecha >= ? AND fecha <= ? AND estado = 'COMPLETADA'
        `, [inicioMes, finMes]);
        
        const corteActual = await runGet("SELECT * FROM cortes_caja WHERE estado = 'ABIERTO'");
        
        res.json({
            total_productos: totalProductos,
            stock_bajo: stockBajo,
            valor_inventario: valorInventario,
            ventas_hoy: ventasHoy,
            ventas_mes: ventasMes,
            corte_actual: corteActual
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/productos-mas-vendidos', verificarAdmin, async (req, res) => {
    try {
        const productos = await runQuery(`
            SELECT p.nombre, p.codigo, SUM(vd.cantidad) as total_vendido, SUM(vd.subtotal) as total_revenue
            FROM venta_detalles vd
            JOIN productos p ON vd.producto_id = p.id
            JOIN ventas v ON vd.venta_id = v.id
            WHERE v.estado = 'COMPLETADA'
            GROUP BY p.id
            ORDER BY total_vendido DESC
            LIMIT 10
        `);
        res.json({ productos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/ventas-ultimos-dias', verificarAdmin, async (req, res) => {
    try {
        const ahora = new Date();
        const inicioSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const ventas = await runQuery(`
            SELECT DATE(fecha) as fecha, COUNT(*) as num_ventas, SUM(total) as monto
            FROM ventas
            WHERE estado = 'COMPLETADA'
            AND fecha >= ?
            GROUP BY DATE(fecha)
            ORDER BY fecha DESC
        `, [inicioSemana]);
        res.json({ ventas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/alertas-stock', verificarAdmin, async (req, res) => {
    try {
        const productos = await runQuery(`
            SELECT * FROM productos 
            WHERE (stock_bodega + stock_tienda) <= stock_minimo 
            AND activo = 1
            ORDER BY (stock_bodega + stock_tienda) ASC
        `);
        res.json({ productos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/ventas-metodo-pago', verificarAdmin, async (req, res) => {
    try {
        const ahora = new Date();
        const treintaDiasAgo = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const ventas = await runQuery(`
            SELECT metodo_pago, COUNT(*) as num_ventas, SUM(total) as monto
            FROM ventas
            WHERE estado = 'COMPLETADA'
            AND fecha >= ?
            GROUP BY metodo_pago
        `, [treintaDiasAgo]);
        res.json({ ventas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
