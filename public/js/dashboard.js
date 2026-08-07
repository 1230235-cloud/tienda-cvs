// Lógica del Dashboard General de Tienda CVS

async function loadDashboardStats() {
    try {
        const response = await apiFetch('/api/dashboard/estadisticas');
        if (!response.ok) return;
        const data = await response.json();
        
        document.getElementById('total-productos').textContent = data.total_productos || 0;
        document.getElementById('stock-bajo').textContent = data.stock_bajo || 0;
        document.getElementById('valor-inventario').textContent = formatCurrency(data.valor_inventario);
        
        // Ventas hoy
        const totalVentasHoy = data.ventas_hoy ? data.ventas_hoy.monto : 0;
        const countVentasHoy = data.ventas_hoy ? data.ventas_hoy.total : 0;
        document.getElementById('ventas-hoy').textContent = formatCurrency(totalVentasHoy);
        document.getElementById('num-ventas-hoy').textContent = `${countVentasHoy} transacciones hoy`;

        // Ventas mes
        const totalVentasMes = data.ventas_mes ? data.ventas_mes.monto : 0;
        const countVentasMes = data.ventas_mes ? data.ventas_mes.total : 0;
        document.getElementById('ventas-mes').textContent = formatCurrency(totalVentasMes);
        document.getElementById('num-ventas-mes').textContent = `${countVentasMes} ventas este mes`;

        // Corte de caja
        const corteEstado = document.getElementById('corte-estado');
        const corteSubtext = document.getElementById('corte-subtext');
        if (data.corte_actual) {
            corteEstado.textContent = 'Abierto';
            corteEstado.className = 'kpi-value status-open';
            corteSubtext.textContent = `Iniciado por ${data.corte_actual.usuario || 'ADMIN'}`;
        } else {
            corteEstado.textContent = 'Cerrado';
            corteEstado.className = 'kpi-value status-closed';
            corteSubtext.textContent = 'Listo para abrir turno';
        }

        // Resaltar tarjeta de alertas si hay productos con stock bajo
        const cardAlertas = document.getElementById('card-alertas');
        if (data.stock_bajo > 0) {
            cardAlertas.classList.add('pulse-alert');
        } else {
            cardAlertas.classList.remove('pulse-alert');
        }

        // Cargar tablas secundarias
        loadAlertasStock();
        loadProductosMasVendidos();
        loadVentasMetodoPago();
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

async function loadAlertasStock() {
    try {
        const response = await apiFetch('/api/dashboard/alertas-stock');
        const data = await response.json();
        const productos = window.ensureArray(data, 'productos');
        
        const tbody = document.getElementById('alertas-body');
        tbody.innerHTML = '';
        
        if (!productos || productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        ✅ Todos los productos tienen stock suficiente.
                    </td>
                </tr>`;
            return;
        }
        
        productos.forEach(producto => {
            const stock = producto.stock_actual ?? producto.stock ?? producto.existencia ?? (parseInt(producto.stock_bodega) || 0) + (parseInt(producto.stock_tienda) || 0);
            const esAgotado = stock <= 0;
            const badgeClass = esAgotado ? 'badge-danger' : 'badge-warning';
            const estadoTexto = esAgotado ? '🚫 Agotado' : '⚠️ Bajo Stock';
            
            row.innerHTML = `
                <td><code>${producto.codigo}</code></td>
                <td><strong>${producto.nombre}</strong></td>
                <td><span class="stock-count ${esAgotado ? 'text-danger' : 'text-warning'}">${stock}</span></td>
                <td>${producto.stock_minimo}</td>
                <td><span class="badge ${badgeClass}">${estadoTexto}</span></td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar alertas de stock:', error);
    }
}

async function loadProductosMasVendidos() {
    try {
        const response = await apiFetch('/api/dashboard/productos-mas-vendidos');
        const data = await response.json();
        const productos = window.ensureArray(data, 'productos');
        
        const tbody = document.getElementById('productos-vendidos-body');
        tbody.innerHTML = '';
        
        if (!productos || productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        No hay ventas registradas aún.
                    </td>
                </tr>`;
            return;
        }
        
        productos.forEach(producto => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${producto.nombre}</strong></td>
                <td><code>${producto.codigo}</code></td>
                <td><span class="badge badge-primary">${producto.total_vendido} u.</span></td>
                <td><strong>${formatCurrency(producto.total_revenue)}</strong></td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar productos más vendidos:', error);
    }
}

async function loadVentasMetodoPago() {
    try {
        const response = await apiFetch('/api/dashboard/ventas-metodo-pago');
        const data = await response.json();
        const ventas = window.ensureArray(data, 'ventas');
        
        const tbody = document.getElementById('metodos-pago-body');
        tbody.innerHTML = '';
        
        if (!ventas || ventas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted">
                        Sin datos registrados.
                    </td>
                </tr>`;
            return;
        }
        
        const iconMap = {
            'EFECTIVO': '💵 Efectivo',
            'TARJETA': '💳 Tarjeta de Débito/Crédito',
            'TRANSFERENCIA': '📱 Transferencia SPEI'
        };

        ventas.forEach(venta => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${iconMap[venta.metodo_pago] || venta.metodo_pago}</strong></td>
                <td>${venta.num_ventas} transacciones</td>
                <td><strong>${formatCurrency(venta.monto)}</strong></td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar ventas por método de pago:', error);
    }
}

// Descargar PDF de ventas del mes
async function descargarPDFVentasMes() {
    try {
        showNotification('Generando PDF de ventas del mes...', 'info');
        
        const response = await apiFetch('/api/ventas');
        const data = await response.json();
        const todasLasVentas = window.ensureArray(data, 'ventas');
        
        // Filtrar ventas del mes actual
        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();
        
        const ventasMes = todasLasVentas.filter(venta => {
            const fechaVenta = new Date(venta.fecha);
            return fechaVenta.getMonth() === mesActual && fechaVenta.getFullYear() === anioActual;
        });
        
        // Calcular totales
        const totalVentas = ventasMes.reduce((sum, v) => sum + (v.total || 0), 0);
        const totalTransacciones = ventasMes.length;
        
        // Agrupar por método de pago
        const ventasPorMetodo = {};
        ventasMes.forEach(venta => {
            const metodo = venta.metodo_pago || 'SIN ESPECIFICAR';
            if (!ventasPorMetodo[metodo]) {
                ventasPorMetodo[metodo] = { cantidad: 0, total: 0 };
            }
            ventasPorMetodo[metodo].cantidad++;
            ventasPorMetodo[metodo].total += venta.total || 0;
        });
        
        // Generar tabla HTML
        let tablaHTML = '<table border="1" cellpadding="10" style="width: 100%; border-collapse: collapse;">';
        tablaHTML += '<thead><tr style="background-color: #667eea; color: white;">';
        tablaHTML += '<th>Folio</th><th>Fecha/Hora</th><th>Cliente</th><th>Monto</th><th>Método</th><th>Estado</th></tr></thead><tbody>';
        
        ventasMes.forEach(venta => {
            const fecha = formatearFechaLocal(venta.fecha);
            tablaHTML += `<tr>
                <td>${venta.folio || '-'}</td>
                <td>${fecha}</td>
                <td>${venta.cliente || 'PÚBLICO'}</td>
                <td>${formatCurrency(venta.total)}</td>
                <td>${venta.metodo_pago || '-'}</td>
                <td>${venta.estado || 'COMPLETADA'}</td>
            </tr>`;
        });
        
        tablaHTML += '</tbody></table>';
        
        // Generar resumen
        let resumenHTML = '<h3>Resumen de Ventas del Mes</h3>';
        resumenHTML += `<p><strong>Total Transacciones:</strong> ${totalTransacciones}</p>`;
        resumenHTML += `<p><strong>Total Ventas:</strong> ${formatCurrency(totalVentas)}</p>`;
        resumenHTML += '<h4>Ventas por Método de Pago:</h4>';
        resumenHTML += '<ul>';
        
        Object.entries(ventasPorMetodo).forEach(([metodo, datos]) => {
            resumenHTML += `<li>${metodo}: ${datos.cantidad} transacciones - ${formatCurrency(datos.total)}</li>`;
        });
        
        resumenHTML += '</ul>';
        
        // Generar PDF
        const mes = ahora.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
        const titulo = `📊 Reporte de Ventas - ${mes.toUpperCase()}`;
        
        let html = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                    h1 { color: #667eea; border-bottom: 3px solid #667eea; padding-bottom: 10px; text-align: center; }
                    h3 { color: #667eea; margin-top: 30px; }
                    h4 { color: #764ba2; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th { background-color: #667eea; color: white; padding: 12px; text-align: left; font-weight: bold; }
                    td { border: 1px solid #ddd; padding: 10px; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
                    .info-box { background: #f0f4ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    ul { margin: 10px 0; padding-left: 20px; }
                    li { margin: 8px 0; }
                </style>
            </head>
            <body>
                <h1>${titulo}</h1>
                <p><strong>Tienda CVS</strong> - Fecha de Reporte: ${new Date().toLocaleDateString('es-MX')}</p>
                
                <div class="info-box">
                    ${resumenHTML}
                </div>
                
                <h3>Detalle de Transacciones</h3>
                ${tablaHTML}
                
                <div class="footer">
                    <p>Documento generado automáticamente por Tienda CVS</p>
                    <p>Este reporte es confidencial y solo para uso interno</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '', 'width=900,height=700');
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Esperar a que cargue el contenido
        printWindow.onload = function() {
            printWindow.print();
            showNotification('PDF listo para descargar', 'success');
        };
        
    } catch (error) {
        console.error('Error al descargar PDF:', error);
        showNotification('Error al generar PDF', 'danger');
    }
}

async function actualizarMétricasDashboard() {
    try {
        const response = await apiFetch('/api/dashboard/estadisticas');
        if (!response.ok) return;
        const data = await response.json();
        
        if (document.getElementById('total-productos')) {
            document.getElementById('total-productos').textContent = data.total_productos || 0;
        }
        if (document.getElementById('stock-bajo')) {
            document.getElementById('stock-bajo').textContent = data.stock_bajo || 0;
        }
        if (document.getElementById('valor-inventario')) {
            document.getElementById('valor-inventario').textContent = formatCurrency(data.valor_inventario);
        }
        if (document.getElementById('ventas-hoy')) {
            const totalVentasHoy = data.ventas_hoy ? data.ventas_hoy.monto : 0;
            document.getElementById('ventas-hoy').textContent = formatCurrency(totalVentasHoy);
        }
        if (document.getElementById('num-ventas-hoy')) {
            const countVentasHoy = data.ventas_hoy ? data.ventas_hoy.total : 0;
            document.getElementById('num-ventas-hoy').textContent = `${countVentasHoy} transacciones hoy`;
        }
        if (document.getElementById('ventas-mes')) {
            const totalVentasMes = data.ventas_mes ? data.ventas_mes.monto : 0;
            document.getElementById('ventas-mes').textContent = formatCurrency(totalVentasMes);
        }
        if (document.getElementById('num-ventas-mes')) {
            const countVentasMes = data.ventas_mes ? data.ventas_mes.total : 0;
            document.getElementById('num-ventas-mes').textContent = `${countVentasMes} ventas este mes`;
        }
    } catch (error) {
        console.error('Error al actualizar métricas del dashboard:', error);
    }
}

window.actualizarMétricasDashboard = actualizarMétricasDashboard;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('dashboard');
    loadDashboardStats();
    
    // Auto-actualizar cada 30 segundos
    setInterval(loadDashboardStats, 30000);
});
