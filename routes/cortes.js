const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper para ejecutar queries con promesas
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const rows = db.all(sql, params);
            resolve(rows);
        } catch (err) {
            reject(err);
        }
    });
}

function runGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const row = db.get(sql, params);
            resolve(row);
        } catch (err) {
            reject(err);
        }
    });
}

function runRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const result = db.run(sql, params);
            resolve({ lastID: result.lastInsertRowid, changes: result.changes });
        } catch (err) {
            reject(err);
        }
    });
}

// Generar folio único
function generarFolio() {
    const fecha = new Date();
    const año = fecha.getFullYear().toString().slice(-2);
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `C${año}${mes}${dia}${random}`;
}

// Obtener todos los cortes de caja
router.get('/', async (req, res) => {
    try {
        const cortes = await runQuery('SELECT * FROM cortes_caja ORDER BY fecha_fin DESC');
        res.json(cortes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener un corte por ID
router.get('/:id', async (req, res) => {
    try {
        const corte = await runGet('SELECT * FROM cortes_caja WHERE id = ?', [req.params.id]);
        if (!corte) {
            return res.status(404).json({ error: 'Corte no encontrado' });
        }
        
        // Obtener movimientos asociados
        const movimientos = await runQuery('SELECT * FROM movimientos_caja WHERE corte_id = ?', [req.params.id]);
        
        // Obtener ventas del periodo
        const ventas = await runQuery(`
            SELECT * FROM ventas 
            WHERE fecha BETWEEN ? AND ?
            AND estado = 'COMPLETADA'
        `, [corte.fecha_inicio, corte.fecha_fin]);
        
        res.json({ ...corte, movimientos, ventas });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar un nuevo corte de caja
router.post('/iniciar', async (req, res) => {
    try {
        const { efectivo_inicial, usuario } = req.body;
        
        // Verificar que no haya un corte abierto
        const corteAbierto = await runGet("SELECT * FROM cortes_caja WHERE estado = 'ABIERTO'");
        if (corteAbierto) {
            return res.status(400).json({ error: 'Ya existe un corte de caja abierto' });
        }

        const folio = generarFolio();
        const fechaInicio = new Date().toISOString();

        const result = await runRun(`
            INSERT INTO cortes_caja (folio, fecha_inicio, efectivo_inicial, usuario, estado)
            VALUES (?, ?, ?, ?, 'ABIERTO')
        `, [folio, fechaInicio, efectivo_inicial || 0, usuario || 'ADMIN']);
        
        res.json({ id: result.lastID, folio, fecha_inicio: fechaInicio });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cerrar corte de caja
router.post('/:id/cerrar', async (req, res) => {
    try {
        const corte = await runGet('SELECT * FROM cortes_caja WHERE id = ?', [req.params.id]);
        if (!corte) {
            return res.status(404).json({ error: 'Corte no encontrado' });
        }
        
        if (corte.estado !== 'ABIERTO') {
            return res.status(400).json({ error: 'El corte ya está cerrado' });
        }

        const fechaFin = new Date().toISOString();

        // Calcular ventas por método de pago
        const ventasEfectivoResult = await runGet(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM ventas 
            WHERE fecha BETWEEN ? AND ? 
            AND metodo_pago = 'EFECTIVO' 
            AND estado = 'COMPLETADA'
        `, [corte.fecha_inicio, fechaFin]);
        const ventasEfectivo = ventasEfectivoResult.total;

        const ventasTarjetaResult = await runGet(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM ventas 
            WHERE fecha BETWEEN ? AND ? 
            AND metodo_pago = 'TARJETA' 
            AND estado = 'COMPLETADA'
        `, [corte.fecha_inicio, fechaFin]);
        const ventasTarjeta = ventasTarjetaResult.total;

        const ventasTransferenciaResult = await runGet(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM ventas 
            WHERE fecha BETWEEN ? AND ? 
            AND metodo_pago = 'TRANSFERENCIA' 
            AND estado = 'COMPLETADA'
        `, [corte.fecha_inicio, fechaFin]);
        const ventasTransferencia = ventasTransferenciaResult.total;

        const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia;
        const efectivoEsperado = (parseFloat(corte.efectivo_inicial) || 0) + ventasEfectivo;
        
        // Si el cliente envía el efectivo contado físicamente en caja, se usa; si no, se asume igual al esperado.
        const efectivoFinal = req.body.efectivo_final !== undefined && req.body.efectivo_final !== null && req.body.efectivo_final !== ''
            ? parseFloat(req.body.efectivo_final)
            : efectivoEsperado;

        const diferencia = efectivoFinal - efectivoEsperado;

        await runRun(`
            UPDATE cortes_caja 
            SET fecha_fin = ?, 
                ventas_efectivo = ?, 
                ventas_tarjeta = ?, 
                ventas_transferencia = ?, 
                total_ventas = ?, 
                efectivo_final = ?, 
                diferencia = ?, 
                estado = 'CERRADO'
            WHERE id = ?
        `, [fechaFin, ventasEfectivo, ventasTarjeta, ventasTransferencia, totalVentas, efectivoFinal, diferencia, req.params.id]);
        
        res.json({ 
            message: 'Corte cerrado exitosamente',
            ventas_efectivo: ventasEfectivo,
            ventas_tarjeta: ventasTarjeta,
            ventas_transferencia: ventasTransferencia,
            total_ventas: totalVentas,
            efectivo_esperado: efectivoEsperado,
            efectivo_final: efectivoFinal,
            diferencia
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener corte abierto
router.get('/abierto/actual', async (req, res) => {
    try {
        const corte = await runGet("SELECT * FROM cortes_caja WHERE estado = 'ABIERTO'");
        if (!corte) {
            return res.json(null);
        }
        
        // Obtener ventas parciales
        const ventasEfectivoResult = await runGet(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM ventas 
            WHERE fecha >= ? 
            AND metodo_pago = 'EFECTIVO' 
            AND estado = 'COMPLETADA'
        `, [corte.fecha_inicio]);
        const ventasEfectivo = ventasEfectivoResult.total;

        const ventasTarjetaResult = await runGet(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM ventas 
            WHERE fecha >= ? 
            AND metodo_pago = 'TARJETA' 
            AND estado = 'COMPLETADA'
        `, [corte.fecha_inicio]);
        const ventasTarjeta = ventasTarjetaResult.total;

        const ventasTransferenciaResult = await runGet(`
            SELECT COALESCE(SUM(total), 0) as total 
            FROM ventas 
            WHERE fecha >= ? 
            AND metodo_pago = 'TRANSFERENCIA' 
            AND estado = 'COMPLETADA'
        `, [corte.fecha_inicio]);
        const ventasTransferencia = ventasTransferenciaResult.total;

        res.json({ 
            ...corte, 
            ventas_efectivo_parcial: ventasEfectivo,
            ventas_tarjeta_parcial: ventasTarjeta,
            ventas_transferencia_parcial: ventasTransferencia
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
