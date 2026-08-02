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

// Obtener estadísticas generales
router.get('/estadisticas', async (req, res) => {
    try {
        // Total productos
        const totalProductosResult = await runGet('SELECT COUNT(*) as total FROM productos');
        const totalProductos = totalProductosResult.total;
        
        // Productos con stock bajo
        const stockBajoResult = await runGet('SELECT COUNT(*) as total FROM productos WHERE stock <= stock_minimo');
        const stockBajo = stockBajoResult.total;
        
        // Valor total del inventario
        const valorInventarioResult = await runGet('SELECT SUM(precio * stock) as total FROM productos');
        const valorInventario = valorInventarioResult.total || 0;
        
        // Ventas de hoy
        const hoy = new Date().toISOString().split('T')[0];
        const ventasHoy = await runGet(`
            SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto 
            FROM ventas 
            WHERE DATE(fecha) = ? AND estado = 'COMPLETADA'
        `, [hoy]);
        
        // Ventas del mes
        const mes = new Date().toISOString().slice(0, 7);
        const ventasMes = await runGet(`
            SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as monto 
            FROM ventas 
            WHERE strftime('%Y-%m', fecha) = ? AND estado = 'COMPLETADA'
        `, [mes]);
        
        // Corte de caja actual
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

// Obtener productos más vendidos
router.get('/productos-mas-vendidos', async (req, res) => {
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
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener ventas por día (últimos 7 días)
router.get('/ventas-ultimos-dias', async (req, res) => {
    try {
        const ventas = await runQuery(`
            SELECT DATE(fecha) as fecha, COUNT(*) as num_ventas, SUM(total) as monto
            FROM ventas
            WHERE estado = 'COMPLETADA'
            AND fecha >= date('now', '-7 days')
            GROUP BY DATE(fecha)
            ORDER BY fecha DESC
        `);
        res.json(ventas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener alertas de stock
router.get('/alertas-stock', async (req, res) => {
    try {
        const productos = await runQuery(`
            SELECT * FROM productos 
            WHERE stock <= stock_minimo 
            ORDER BY stock ASC
        `);
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener resumen de ventas por método de pago
router.get('/ventas-metodo-pago', async (req, res) => {
    try {
        const ventas = await runQuery(`
            SELECT metodo_pago, COUNT(*) as num_ventas, SUM(total) as monto
            FROM ventas
            WHERE estado = 'COMPLETADA'
            AND fecha >= date('now', '-30 days')
            GROUP BY metodo_pago
        `);
        res.json(ventas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
