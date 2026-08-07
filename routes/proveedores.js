const express = require('express');
const router = express.Router();
const { runGet, runRun } = require('../database');

router.get('/', async (req, res) => {
    try {
        const proveedores = await runQuery('SELECT id, nombre, contacto, telefono, observaciones FROM proveedores ORDER BY nombre');
        res.json({ proveedores });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre, contacto, telefono, observaciones } = req.body;
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del proveedor es requerido' });
        }

        const existente = await runGet('SELECT id FROM proveedores WHERE nombre = ?', [nombre.trim()]);
        if (existente) {
            return res.json({ proveedor: { id: existente.id, nombre: nombre.trim(), contacto, telefono, observaciones } });
        }

        const result = await runRun(
            'INSERT INTO proveedores (nombre, contacto, telefono, observaciones) VALUES (?, ?, ?, ?)',
            [nombre.trim(), contacto || '', telefono || '', observaciones || '']
        );

        res.status(201).json({
            proveedor: {
                id: result.lastID,
                nombre: nombre.trim(),
                contacto: contacto || '',
                telefono: telefono || '',
                observaciones: observaciones || ''
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, contacto, telefono, observaciones } = req.body;

        const existente = await runGet('SELECT id FROM proveedores WHERE id = ?', [id]);
        if (!existente) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        await runRun(
            'UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, observaciones = ? WHERE id = ?',
            [nombre || existente.nombre, contacto || '', telefono || '', observaciones || '', id]
        );

        const actualizado = await runGet('SELECT * FROM proveedores WHERE id = ?', [id]);
        res.json(actualizado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const existente = await runGet('SELECT id FROM proveedores WHERE id = ?', [id]);
        if (!existente) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        await runRun('DELETE FROM proveedores WHERE id = ?', [id]);
        res.json({ mensaje: 'Proveedor eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
