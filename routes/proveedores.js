const express = require('express');
const router = express.Router();
const { runGet, runRun } = require('../database');

router.get('/', async (req, res) => {
    try {
        const proveedores = await runQuery('SELECT * FROM proveedores ORDER BY nombre');
        return res.status(200).json({ proveedores });
    } catch (error) {
        console.error('ERROR CRÍTICO EN /api/proveedores:', error);

        try {
            await exec(`
                CREATE TABLE IF NOT EXISTS proveedores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL UNIQUE,
                    contacto TEXT,
                    telefono TEXT,
                    observaciones TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Tabla proveedores creada/verificada automáticamente');
            return res.status(200).json({ proveedores: [] });
        } catch (dbError) {
            console.error('Error al crear tabla proveedores:', dbError);
            return res.status(200).json({ proveedores: [] });
        }
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre, contacto, telefono, observaciones } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, error: 'El nombre del proveedor es requerido' });
        }

        const nombreLimpio = nombre.trim();

        const existente = await runGet('SELECT id FROM proveedores WHERE nombre = ?', [nombreLimpio]);
        if (existente) {
            return res.status(200).json({
                success: true,
                message: 'Proveedor ya existente',
                proveedor: {
                    id: existente.id,
                    nombre: nombreLimpio,
                    contacto: contacto || '',
                    telefono: telefono || '',
                    observaciones: observaciones || ''
                }
            });
        }

        const result = await runRun(
            'INSERT INTO proveedores (nombre, contacto, telefono, observaciones) VALUES (?, ?, ?, ?)',
            [nombreLimpio, contacto || '', telefono || '', observaciones || '']
        );

        const nuevoId = result.lastID;
        console.log('POST /api/proveedores - Insertado con ID:', nuevoId);

        if (!nuevoId || nuevoId === 0) {
            console.error('ERROR: lastID no retornado, leyendo registro insertado...');
            const recienCreado = await runGet('SELECT * FROM proveedores WHERE nombre = ? ORDER BY id DESC LIMIT 1', [nombreLimpio]);
            if (!recienCreado) {
                return res.status(500).json({ success: false, error: 'No se pudo confirmar la inserción del proveedor' });
            }
            return res.status(200).json({
                success: true,
                message: 'Proveedor guardado correctamente',
                proveedor: {
                    id: recienCreado.id,
                    nombre: recienCreado.nombre,
                    contacto: recienCreado.contacto || '',
                    telefono: recienCreado.telefono || '',
                    observaciones: recienCreado.observaciones || ''
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Proveedor guardado correctamente',
            proveedor: {
                id: nuevoId,
                nombre: nombreLimpio,
                contacto: contacto || '',
                telefono: telefono || '',
                observaciones: observaciones || ''
            }
        });
    } catch (error) {
        console.error('ERROR CRÍTICO EN POST /api/proveedores:', error);
        return res.status(500).json({ success: false, error: error.message });
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
        console.error('ERROR CRÍTICO EN PUT /api/proveedores/:id:', error);
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
        console.error('ERROR CRÍTICO EN DELETE /api/proveedores/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
