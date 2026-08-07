const express = require('express');
const router = express.Router();
const { runGet, runRun } = require('../database');

router.get('/', async (req, res) => {
    try {
        const proveedores = await runQuery('SELECT id, nombre, contacto, telefono FROM proveedores ORDER BY nombre');
        res.json({ proveedores });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre, contacto, telefono } = req.body;
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del proveedor es requerido' });
        }

        const existente = await runGet('SELECT id FROM proveedores WHERE nombre = ?', [nombre.trim()]);
        if (existente) {
            return res.json({ proveedor: { id: existente.id, nombre: nombre.trim(), contacto, telefono } });
        }

        const result = await runRun(
            'INSERT INTO proveedores (nombre, contacto, telefono) VALUES (?, ?, ?)',
            [nombre.trim(), contacto || '', telefono || '']
        );

        res.status(201).json({
            proveedor: {
                id: result.lastID,
                nombre: nombre.trim(),
                contacto: contacto || '',
                telefono: telefono || ''
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
