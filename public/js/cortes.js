let corteActual = null;

// Cargar estado actual de caja
async function loadEstadoCaja() {
    try {
        const response = await apiFetch('/api/cortes/abierto/actual');
        const corte = await response.json();
        
        const infoDiv = document.getElementById('corte-abierto-info');
        
        if (corte) {
            corteActual = corte;
            infoDiv.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <p><strong>Folio:</strong> ${corte.folio}</p>
                        <p><strong>Inicio:</strong> ${formatearFechaLocal(corte.fecha_inicio)}</p>
                    </div>
                    <div>
                        <p><strong>Efectivo Inicial:</strong> ${formatCurrency(corte.efectivo_inicial)}</p>
                        <p><strong>Ventas Efectivo:</strong> ${formatCurrency(corte.ventas_efectivo_parcial || 0)}</p>
                    </div>
                    <div>
                        <p><strong>Ventas Tarjeta:</strong> ${formatCurrency(corte.ventas_tarjeta_parcial || 0)}</p>
                        <p><strong>Ventas Transferencia:</strong> ${formatCurrency(corte.ventas_transferencia_parcial || 0)}</p>
                    </div>
                </div>
            `;
        } else {
            corteActual = null;
            infoDiv.innerHTML = '<p>No hay corte de caja abierto</p>';
        }
        
        loadCortesHistorial();
    } catch (error) {
        console.error('Error al cargar estado de caja:', error);
    }
}

// Iniciar corte
async function iniciarCorte() {
    if (corteActual) {
        alert('Ya hay un corte de caja abierto');
        return;
    }
    
    const efectivoInicial = parseFloat(document.getElementById('efectivo-inicial').value) || 0;
    const usuario = document.getElementById('usuario').value;
    
    try {
        const response = await apiFetch('/api/cortes/iniciar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ efectivo_inicial: efectivoInicial, usuario })
        });
        
        if (response.ok) {
            alert('Corte de caja iniciado exitosamente');
            loadEstadoCaja();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error al iniciar corte:', error);
        alert('Error al iniciar corte de caja');
    }
}

// Cerrar corte con Arqueo de Caja (Conteo físico)
async function cerrarCorte() {
    if (!corteActual) {
        showToast('Atención', 'No hay un corte de caja abierto actualmente.', 'warning');
        return;
    }

    const ventasEfectivo = parseFloat(corteActual.ventas_efectivo_parcial || 0);
    const efectivoInicial = parseFloat(corteActual.efectivo_inicial || 0);
    const efectivoEsperado = efectivoInicial + ventasEfectivo;

    const modalBody = `
        <div class="corte-modal-body">
            <p style="margin-bottom: 15px; color: var(--gray-700);">
                Ingresa el <strong>efectivo total contado en el cajón</strong> para realizar el arqueo de caja:
            </p>
            <div class="detail-summary-card" style="background: var(--gray-100); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Efectivo Inicial:</span>
                    <strong>${formatCurrency(efectivoInicial)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Ventas en Efectivo del turno:</span>
                    <strong style="color: var(--success-color);">${formatCurrency(ventasEfectivo)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-top: 1px dashed #ccc; padding-top: 8px;">
                    <span><strong>Efectivo Esperado en Caja:</strong></span>
                    <strong style="color: var(--primary-accent); font-size: 1.1em;">${formatCurrency(efectivoEsperado)}</strong>
                </div>
            </div>
            <div class="form-group">
                <label for="efectivo-contado-input"><strong>Efectivo Físico Contado ($):</strong></label>
                <input type="number" step="0.01" id="efectivo-contado-input" class="input-control input-lg" value="${efectivoEsperado}" autofocus style="font-size: 1.2em; font-weight: 700; color: var(--gray-900);">
            </div>
        </div>
    `;

    const modalFooter = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-warning btn-lg" id="btn-confirmar-cierre">🔒 Confirmar Cierre y Arqueo</button>
    `;

    createModal(`🔴 Cerrar Corte de Caja - ${corteActual.folio}`, modalBody, modalFooter);

    const btnConfirmar = document.getElementById('btn-confirmar-cierre');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', async () => {
            const inputVal = document.getElementById('efectivo-contado-input').value;
            const efectivoFinal = parseFloat(inputVal);

            if (isNaN(efectivoFinal) || efectivoFinal < 0) {
                showToast('Monto inválido', 'Por favor ingresa un monto de efectivo válido.', 'error');
                return;
            }

            btnConfirmar.disabled = true;
            btnConfirmar.textContent = 'Cerrando... ⏳';

            try {
                const response = await apiFetch(`/api/cortes/${corteActual.id}/cerrar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ efectivo_final: efectivoFinal })
                });

                closeModal();

                if (response.ok) {
                    const result = await response.json();
                    const dif = result.diferencia;
                    let mensajeDif = 'Caja cuadrada perfectamente (Diferencia: $0.00)';
                    let toastType = 'success';

                    if (dif > 0) {
                        mensajeDif = `⚠️ Sobrante de caja: ${formatCurrency(dif)}`;
                        toastType = 'warning';
                    } else if (dif < 0) {
                        mensajeDif = `❌ Faltante de caja: ${formatCurrency(dif)}`;
                        toastType = 'error';
                    }

                    showToast('Corte Cerrado Exitosamente', `Folio: ${corteActual.folio}. ${mensajeDif}`, toastType);
                    loadEstadoCaja();
                } else {
                    const error = await response.json();
                    showToast('Error al cerrar corte', error.error || 'No se pudo cerrar el corte', 'error');
                }
            } catch (error) {
                console.error('Error al cerrar corte:', error);
                showToast('Error de conexión', 'Ocurrió un error al intentar cerrar el corte', 'error');
            }
        });
    }
}

// Cargar historial de cortes
async function loadCortesHistorial() {
    try {
        const response = await apiFetch('/api/cortes');
        const data = await response.json();
        const cortes = window.ensureArray(data, 'cortes');
        
        // Llenar tabla de últimos cortes (primero)
        const tbody = document.getElementById('cortes-body');
        if (tbody) {
            tbody.innerHTML = '';
            
            if (cortes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay cortes registrados</td></tr>';
            } else {
                cortes.slice(0, 5).forEach(corte => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${corte.folio}</td>
                        <td>${formatearFechaLocal(corte.fecha_inicio)}</td>
                        <td>${formatCurrency(corte.total_ventas)}</td>
                        <td><span style="color: ${corte.estado === 'ABIERTO' ? 'green' : 'orange'}">${corte.estado}</span></td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="verDetalle(${corte.id})">📋 Ver</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        }
        
        // Llenar tabla de historial completo
        const tbodyCompleto = document.getElementById('cortes-body-completo');
        if (tbodyCompleto) {
            tbodyCompleto.innerHTML = '';
            
            if (cortes.length === 0) {
                tbodyCompleto.innerHTML = '<tr><td colspan="11" style="text-align: center;">No hay cortes registrados</td></tr>';
                return;
            }
            
            cortes.forEach(corte => {
                const row = document.createElement('tr');
                const diferenciaColor = corte.diferencia !== 0 ? (corte.diferencia > 0 ? 'green' : 'red') : 'inherit';
                row.innerHTML = `
                    <td>${corte.folio}</td>
                    <td>${formatearFechaLocal(corte.fecha_inicio)}</td>
                    <td>${formatearFechaLocal(corte.fecha_fin) || '-'}</td>
                    <td>${formatCurrency(corte.efectivo_inicial)}</td>
                    <td>${formatCurrency(corte.ventas_efectivo)}</td>
                    <td>${formatCurrency(corte.ventas_tarjeta)}</td>
                    <td>${formatCurrency(corte.ventas_transferencia)}</td>
                    <td>${formatCurrency(corte.total_ventas)}</td>
                    <td style="color: ${diferenciaColor}; font-weight: bold;">${formatCurrency(corte.diferencia || 0)}</td>
                    <td><span style="color: ${corte.estado === 'ABIERTO' ? 'green' : 'orange'}">${corte.estado}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="verDetalle(${corte.id})">📋 Ver</button>
                    </td>
                `;
                tbodyCompleto.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error al cargar historial de cortes:', error);
    }
}

// Ver detalle del corte actual
function verDetalleCorteActual() {
    if (!corteActual) {
        showNotification('No hay un corte de caja abierto', 'warning');
        return;
    }
    verDetalle(corteActual.id);
}

// Ver detalle de corte
async function verDetalle(id) {
    try {
        const response = await apiFetch(`/api/cortes/${id}`);
        const corte = await response.json();
        
        window.corteActual = corte;
        
        const content = document.getElementById('detalle-corte-content');
        const ahora = formatearFechaLocal(new Date());
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <p><strong>Folio:</strong> ${corte.folio}</p>
                <p><strong>Fecha Inicio:</strong> ${formatearFechaLocal(corte.fecha_inicio)}</p>
                <p><strong>Fecha Fin:</strong> ${formatearFechaLocal(corte.fecha_fin)}</p>
                <p><strong>Usuario:</strong> ${corte.usuario}</p>
                <p><strong>Estado:</strong> ${corte.estado}</p>
                <p><strong>Reporte Generado:</strong> ${ahora}</p>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button class="btn btn-primary" onclick="imprimirCorte()">🖨️ Imprimir Corte de Caja</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                    <h4>💵 Efectivo</h4>
                    <p><strong>Inicial:</strong> ${formatCurrency(corte.efectivo_inicial)}</p>
                    <p><strong>Ventas:</strong> ${formatCurrency(corte.ventas_efectivo)}</p>
                    <p><strong>Final:</strong> ${formatCurrency(corte.efectivo_final)}</p>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                    <h4>💳 Otros Métodos</h4>
                    <p><strong>Tarjeta:</strong> ${formatCurrency(corte.ventas_tarjeta)}</p>
                    <p><strong>Transferencia:</strong> ${formatCurrency(corte.ventas_transferencia)}</p>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                    <h4>📊 Totales</h4>
                    <p><strong>Total Ventas:</strong> ${formatCurrency(corte.total_ventas)}</p>
                    <p><strong>Diferencia:</strong> <span style="color: ${corte.diferencia !== 0 ? (corte.diferencia > 0 ? 'green' : 'red') : 'inherit'}">${formatCurrency(corte.diferencia)}</span></p>
                </div>
            </div>
            <h3>Ventas del Periodo (${corte.ventas ? corte.ventas.length : 0})</h3>
            <div style="max-height: 300px; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Folio</th>
                            <th>Fecha</th>
                            <th>Total</th>
                            <th>Método</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${corte.ventas ? corte.ventas.map(venta => `
                            <tr>
                                <td>${venta.folio}</td>
                                <td>${formatearFechaLocal(venta.fecha)}</td>
                                <td>${formatCurrency(venta.total)}</td>
                                <td>${venta.metodo_pago}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align: center;">No hay ventas</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        
        document.getElementById('detalle-corte-modal').classList.add('active');
    } catch (error) {
        console.error('Error al cargar corte:', error);
    }
}

// Imprimir corte de caja
function imprimirCorte() {
    const corte = window.corteActual;
    if (!corte) {
        alert('No se encontraron datos del corte para imprimir');
        return;
    }

    const ahora = formatearFechaLocal(new Date());

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Corte de Caja</title>
    <style>
        @media print {
            @page {
                size: 80mm auto;
                margin: 0;
            }
        }
        body {
            width: 76mm;
            margin: 0 auto;
            padding: 5px 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11pt;
            color: #000;
            background: #fff;
            line-height: 1.3;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }

        .ticket-container {
            width: 100% !important;
            max-width: 300px !important;
            margin: 0 auto !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
        }

        .ticket-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            margin-top: 8px !important;
            margin-bottom: 8px !important;
        }

        .ticket-table th,
        .ticket-table td {
            padding: 2px 0 !important;
        }

        .col-cant {
            width: 15% !important;
            text-align: left !important;
        }

        .col-desc {
            width: 50% !important;
            text-align: left !important;
            padding-right: 5px !important;
            word-wrap: break-word !important;
        }

        .col-importe {
            width: 35% !important;
            text-align: right !important;
            padding-right: 0 !important;
            white-space: nowrap !important;
        }

        .header { margin-bottom: 10px; }
        .header h1 {
            margin: 0 0 3px 0;
            font-size: 13pt;
            font-weight: bold;
        }
        .header p {
            margin: 1px 0;
            font-size: 9.5pt;
            text-transform: uppercase;
        }

        .datetime-row {
            text-align: right;
            font-size: 9.5pt;
            margin-bottom: 4px;
        }

        .meta-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5pt;
            margin-bottom: 8px;
        }
        .meta-table td { padding: 1px 0; }

        .section-title {
            font-size: 10pt;
            font-weight: bold;
            margin: 8px 0 4px 0;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            margin-bottom: 8px;
        }
        .summary-grid .label { font-size: 9pt; }
        .summary-grid .value { font-size: 9pt; text-align: right; }

        .total-row {
            font-size: 11pt;
            font-weight: bold;
            border-top: 2px solid #000;
        }

        .footer {
            margin-top: 12px;
            font-size: 9pt;
            text-align: center;
        }
        .footer p { margin: 2px 0; }

        .signature-line {
            margin-top: 30px;
            border-top: 1px solid #000;
            width: 60%;
            margin-left: auto;
            margin-right: auto;
            text-align: center;
            font-size: 9pt;
            padding-top: 2px;
        }
    </style>
</head>
<body>
    <div class="ticket-container">
        <div class="header text-center">
            <h1>CENTRO DE VIDA SANA</h1>
            <p>CORTE DE CAJA</p>
            <p>FILIBERTO VERDUZCO AVILA</p>
            <p>19A PONIENTE SUR, LIBRAMIENTO SUR</p>
            <p>961 575 7310</p>
            <p>RFC: CVS2210111B0</p>
        </div>

        <div class="datetime-row">
            <span>${ahora}</span>
        </div>

        <table class="meta-table">
            <tr>
                <td style="width: 30%;">FOLIO:</td>
                <td class="text-right">${corte.folio}</td>
            </tr>
            <tr>
                <td>CAJERO:</td>
                <td class="text-right">${corte.usuario}</td>
            </tr>
            <tr>
                <td>ESTADO:</td>
                <td class="text-right">${corte.estado}</td>
            </tr>
        </table>

        <div class="section-title">RESUMEN DE INGRESOS</div>
        <table class="ticket-table">
            <thead>
                <tr>
                    <th class="col-cant">#</th>
                    <th class="col-desc">CONCEPTO</th>
                    <th class="col-importe">IMPORTE</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="col-cant">1</td>
                    <td class="col-desc">Efectivo Inicial</td>
                    <td class="col-importe">${formatCurrency(corte.efectivo_inicial)}</td>
                </tr>
                <tr>
                    <td class="col-cant">2</td>
                    <td class="col-desc">Ventas Efectivo</td>
                    <td class="col-importe">${formatCurrency(corte.ventas_efectivo)}</td>
                </tr>
                <tr>
                    <td class="col-cant">3</td>
                    <td class="col-desc">Ventas Tarjeta</td>
                    <td class="col-importe">${formatCurrency(corte.ventas_tarjeta)}</td>
                </tr>
                <tr>
                    <td class="col-cant">4</td>
                    <td class="col-desc">Ventas Transferencia</td>
                    <td class="col-importe">${formatCurrency(corte.ventas_transferencia)}</td>
                </tr>
                <tr class="total-row">
                    <td class="col-cant"></td>
                    <td class="col-desc"><strong>TOTAL EN CAJA</strong></td>
                    <td class="col-importe"><strong>${formatCurrency(corte.total_ventas)}</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="section-title">ARQUEO</div>
        <table class="ticket-table">
            <thead>
                <tr>
                    <th class="col-cant">#</th>
                    <th class="col-desc">CONCEPTO</th>
                    <th class="col-importe">IMPORTE</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="col-cant">1</td>
                    <td class="col-desc">Efectivo en Caja (Final)</td>
                    <td class="col-importe">${formatCurrency(corte.efectivo_final)}</td>
                </tr>
                <tr>
                    <td class="col-cant">2</td>
                    <td class="col-desc">Total Ventas (Cobrado)</td>
                    <td class="col-importe">${formatCurrency(corte.total_ventas)}</td>
                </tr>
                <tr>
                    <td class="col-cant">3</td>
                    <td class="col-desc">Diferencia (Sobrante/Faltante)</td>
                    <td class="col-importe" style="color: ${corte.diferencia !== 0 ? (corte.diferencia > 0 ? 'green' : 'red') : 'inherit'}; font-weight: bold;">${formatCurrency(corte.diferencia || 0)}</td>
                </tr>
            </tbody>
        </table>

        <div class="signature-line">FIRMA DEL CAJERO</div>

        <div class="footer text-center">
            <p>GRACIAS POR SU PREFERENCIA</p>
            <p>WWW.ABARROTESPUNTODEVENTA.COM</p>
        </div>
    </div>

    <script>
        window.onload = function() { window.print(); window.close(); };
    </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('detalle-corte-modal').classList.remove('active');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('cortes');
    loadEstadoCaja();
    
    // Recargar estado cada 30 segundos
    setInterval(loadEstadoCaja, 30000);
});
