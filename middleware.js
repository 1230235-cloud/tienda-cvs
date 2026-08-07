const { runGet } = require('./database');

async function verificarAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No autorizado: Se requiere token de autenticación' });
    }

    try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const [userId] = decoded.split(':');

        if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const user = await runGet('SELECT id, username, rol FROM usuarios WHERE id = ?', [userId]);
        if (!user || user.rol.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de Administrador' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

module.exports = { verificarAdmin };