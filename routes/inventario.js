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

// Obtener todos los productos
router.get('/', async (req, res) => {
    try {
        const productos = await runQuery('SELECT * FROM productos ORDER BY nombre');
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener un producto por ID
router.get('/:id', async (req, res) => {
    try {
        const producto = await runGet('SELECT * FROM productos WHERE id = ?', [req.params.id]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar producto por código
router.get('/codigo/:codigo', async (req, res) => {
    try {
        const producto = await runGet('SELECT * FROM productos WHERE codigo = ?', [req.params.codigo]);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear nuevo producto - BLOQUEADO (solo desde Entradas)
router.post('/', async (req, res) => {
    return res.status(403).json({ error: 'No se pueden crear productos desde inventario. Use el módulo de Entradas de Mercancía para agregar nuevos productos.' });
});

// Actualizar producto - BLOQUEADO (solo desde Entradas)
router.put('/:id', async (req, res) => {
    return res.status(403).json({ error: 'No se pueden editar productos desde inventario. Use el módulo de Entradas de Mercancía para modificar stock o precios.' });
});

// Eliminar producto - BLOQUEADO
router.delete('/:id', async (req, res) => {
    return res.status(403).json({ error: 'No se pueden eliminar productos desde inventario.' });
});

// Obtener productos con stock bajo
router.get('/alertas/stock-bajo', async (req, res) => {
    try {
        const productos = await runQuery('SELECT * FROM productos WHERE stock <= stock_minimo');
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
