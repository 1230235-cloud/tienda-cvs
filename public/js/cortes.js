let corteActual = null;

// Cargar estado actual de caja
async function loadEstadoCaja() {
    try {
        const response = await fetch('/api/cortes/abierto/actual');
        const corte = await response.json();
        
        const infoDiv = document.getElementById('corte-abierto-info');
        
        if (corte) {
            corteActual = corte;
            infoDiv.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <p><strong>Folio:</strong> ${corte.folio}</p>
                        <p><strong>Inicio:</strong> ${formatDate(corte.fecha_inicio)}</p>
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
        const response = await fetch('/api/cortes/iniciar', {
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
                const response = await fetch(`/api/cortes/${corteActual.id}/cerrar`, {
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
        const response = await fetch('/api/cortes');
        const cortes = await response.json();
        
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
                        <td>${formatDate(corte.fecha_inicio)}</td>
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
                    <td>${formatDate(corte.fecha_inicio)}</td>
                    <td>${formatDate(corte.fecha_fin) || '-'}</td>
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
        const response = await fetch(`/api/cortes/${id}`);
        const corte = await response.json();
        
        const content = document.getElementById('detalle-corte-content');
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <p><strong>Folio:</strong> ${corte.folio}</p>
                <p><strong>Fecha Inicio:</strong> ${formatDate(corte.fecha_inicio)}</p>
                <p><strong>Fecha Fin:</strong> ${formatDate(corte.fecha_fin)}</p>
                <p><strong>Usuario:</strong> ${corte.usuario}</p>
                <p><strong>Estado:</strong> ${corte.estado}</p>
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
                                <td>${formatDate(venta.fecha)}</td>
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
