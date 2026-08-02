const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcrypt');

// Helper para ejecutar queries con promesas
function runGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

// Iniciar sesión
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        const user = await runGet('SELECT * FROM usuarios WHERE username = ?', [username]);
        
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        let validPassword = false;
        try {
            validPassword = await bcrypt.compare(password, user.password);
        } catch (e) {
            validPassword = false;
        }

        if (!validPassword && user.password !== password) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (!validPassword && user.password === password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await run('UPDATE usuarios SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        }

        // Generar token simple para la sesión (solo ID y timestamp)
        const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

        res.json({
            message: 'Inicio de sesión exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verificar token de sesión
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const [userId] = decoded.split(':');

        const user = await runGet('SELECT id, username, nombre, rol FROM usuarios WHERE id = ?', [userId]);
        
        if (!user) {
            return res.status(401).json({ error: 'Sesión inválida' });
        }

        res.json({ valid: true, user });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

// Registrar nuevo usuario
router.post('/register', async (req, res) => {
    try {
        const { username, password, nombre, rol } = req.body;
        
        if (!username || !password || !nombre) {
            return res.status(400).json({ error: 'Usuario, contraseña y nombre son requeridos' });
        }

        const existingUser = await runGet('SELECT id FROM usuarios WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await run(
            'INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, nombre, rol || 'CAJERO']
        );

        res.json({
            message: 'Usuario creado exitosamente',
            user: { id: result.id, username, nombre, rol: rol || 'CAJERO' }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
