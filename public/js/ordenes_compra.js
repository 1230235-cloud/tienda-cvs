let ordenDetalles = [];
let ordenesList = [];

async function loadOrdenes() {
    try {
        const res = await apiFetch('/api/ordenes');
        if (!res.ok) return;
        const data = await res.json();
        ordenesList = window.ensureArray(data, 'ordenes');
        renderOrdenes();
    } catch (error) {
        console.error('Error al cargar órdenes:', error);
    }
}

async function loadProveedores() {
    try {
        const res = await apiFetch('/api/proveedores');
        if (!res.ok) return;
        const data = await res.json();
        const proveedores = window.ensureArray(data, 'proveedores');
        const select = document.getElementById('orden-proveedor');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
            '<option value="__nuevo__">➕ Agregar Nuevo Proveedor</option>';
        proveedores.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.nombre;
            opt.textContent = p.nombre;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error al cargar proveedores:', error);
    }
}

function filtrarProductosPorProveedor(proveedorSeleccionado, listaProductos) {
    if (!proveedorSeleccionado || proveedorSeleccionado === '' || proveedorSeleccionado === 'todos') {
        return listaProductos;
    }

    return listaProductos.filter(producto => {
        const provProductoID = String(producto.id_proveedor || producto.proveedor_id || '').trim();
        const provProductoNombre = String(producto.proveedor || producto.nombre_proveedor || '').trim().toLowerCase();

        const busqueda = String(proveedorSeleccionado).trim().toLowerCase();

        return provProductoID === busqueda || provProductoNombre === busqueda || provProductoNombre.includes(busqueda);
    });
}

async function loadProductosByProveedor(proveedor) {
    const select = document.getElementById('orden-producto');
    if (!select) return;

    select.innerHTML = '<option value="">-- Ver todos los productos --</option>';

    try {
        const res = await apiFetch(`/api/productos-por-proveedor?proveedor=${encodeURIComponent(proveedor)}`);
        if (!res.ok) return;
        const data = await res.json();
        const productos = Array.isArray(data) ? data : (data.productos || []);

        productos.forEach(p => {
            const stockTotal = (parseInt(p.stock_bodega) || 0) + (parseInt(p.stock_tienda) || 0);
            const sugerido = Math.max(1, (parseInt(p.stock_minimo) || 5) - stockTotal);
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.codigo} - ${p.nombre} (Stock: ${stockTotal}, Mín: ${p.stock_minimo || 5}, Sugerido: ${sugerido})`;
            opt.dataset.precio = p.precio_publico || p.precio || 0;
            opt.dataset.nombre = p.nombre || '';
            opt.dataset.codigo = p.codigo || '';
            opt.dataset.sugerido = sugerido;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function agregarProductoOrden() {
    const productoId = document.getElementById('orden-producto').value;
    const cantidad = parseInt(document.getElementById('orden-cantidad').value) || 0;
    const costo = parseFloat(document.getElementById('orden-costo').value) || 0;

    if (!productoId) {
        showToast('Error', 'Selecciona un producto', 'error');
        return;
    }

    if (cantidad <= 0) {
        showToast('Error', 'La cantidad debe ser mayor a 0', 'error');
        return;
    }

    if (costo <= 0) {
        showToast('Error', 'El costo unitario debe ser mayor a 0', 'error');
        return;
    }

    const select = document.getElementById('orden-producto');
    const selectedOption = select.options[select.selectedIndex];
    const descripcion = selectedOption.dataset.nombre || '';
    const codigo = selectedOption.dataset.codigo || '';

    const subtotal = cantidad * costo;

    const existente = ordenDetalles.find(d => d.producto_id === parseInt(productoId));
    if (existente) {
        existente.cantidad += cantidad;
        existente.subtotal = existente.cantidad * existente.costo;
    } else {
        ordenDetalles.push({
            producto_id: parseInt(productoId),
            descripcion: codigo ? `${codigo} - ${descripcion}` : descripcion,
            cantidad,
            costo,
            subtotal
        });
    }

    renderOrdenDetalles();
    limpiarCamposProducto();
}

function limpiarCamposProducto() {
    const cantidadInput = document.getElementById('orden-cantidad');
    const costoInput = document.getElementById('orden-costo');
    const productoSelect = document.getElementById('orden-producto');

    if (cantidadInput) cantidadInput.value = 1;
    if (costoInput) costoInput.value = '';
    if (productoSelect) productoSelect.value = '';
}

async function renderOrdenDetalles() {
    const tbody = document.getElementById('orden-detalles-body');
    if (!tbody) return;

    if (ordenDetalles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay productos agregados</td></tr>';
        updateOrdenTotals();
        return;
    }

    tbody.innerHTML = ordenDetalles.map((d, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><input type="number" class="input-control" style="width: 80px;" value="${d.cantidad}" min="0" onchange="actualizarCantidadDetalle(${index}, this.value)"></td>
            <td>${d.descripcion}</td>
            <td class="text-right">$${d.costo.toFixed(2)}</td>
            <td class="text-right">$${d.subtotal.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="eliminarDetalleOrden(${index})">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');

    updateOrdenTotals();
}

function eliminarDetalleOrden(index) {
    ordenDetalles.splice(index, 1);
    renderOrdenDetalles();
}

function actualizarCantidadDetalle(index, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad) || 0;
    if (cantidad < 0) {
        showToast('Error', 'La cantidad no puede ser negativa', 'error');
        renderOrdenDetalles();
        return;
    }
    ordenDetalles[index].cantidad = cantidad;
    ordenDetalles[index].subtotal = cantidad * ordenDetalles[index].costo;
    renderOrdenDetalles();
}

function updateOrdenTotals() {
    const totalItems = ordenDetalles.reduce((sum, d) => sum + d.cantidad, 0);
    const total = ordenDetalles.reduce((sum, d) => sum + d.subtotal, 0);

    const totalItemsEl = document.getElementById('orden-total-items');
    const totalEl = document.getElementById('orden-total');

    if (totalItemsEl) totalItemsEl.textContent = totalItems;
    if (totalEl) totalEl.textContent = formatCurrency(total);
}

async function guardarOrden() {
    const proveedor = document.getElementById('orden-proveedor').value;
    const solicita = document.getElementById('orden-solicita').value.trim();
    const autoriza = document.getElementById('orden-autoriza').value.trim();

    if (!proveedor) {
        showToast('Error', 'Debe seleccionar un proveedor', 'error');
        return;
    }

    if (ordenDetalles.length === 0) {
        showToast('Error', 'Debe agregar al menos un producto a la orden', 'error');
        return;
    }

    try {
        const res = await apiFetch('/api/ordenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proveedor,
                solicita,
                autoriza,
                detalles: ordenDetalles
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Orden Guardada', `Orden #${data.ordenId} creada correctamente. Total: ${formatCurrency(data.total)}`, 'success');
            imprimirOrden(data.ordenId);
            limpiarOrden();
            loadOrdenes();
        } else {
            showToast('Error', data.error || 'No se pudo guardar la orden', 'error');
        }
    } catch (error) {
        console.error('Error al guardar orden:', error);
        showToast('Error de Conexión', 'No se pudo conectar con el servidor', 'error');
    }
}

async function imprimirOrden(ordenId) {
    try {
        const res = await apiFetch(`/api/ordenes/${ordenId}`);
        if (!res.ok) {
            showToast('Error', 'No se pudo cargar la orden para imprimir', 'error');
            return;
        }

        const data = await res.json();
        const orden = data.orden;
        const detalles = window.ensureArray(data, 'detalles');

        const fechaEmision = new Date(orden.fecha).toLocaleString('es-MX', {
            timeZone: 'America/Mexico_City',
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        let filasHTML = detalles.map((d, index) => `
            <tr>
                <td style="text-align:center;">${index + 1}</td>
                <td>${d.cantidad}</td>
                <td>${d.descripcion}</td>
                <td style="text-align:right;">$${d.costo.toFixed(2)}</td>
                <td style="text-align:right;">$${d.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        const ventana = window.open('', '', 'height=800,width=950');
        ventana.document.write(`
            <html>
                <head>
                    <title>Órden de Compra #${orden.id}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #1a202c; font-size: 12px; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 10px; }
                        .header h1 { margin: 0; font-size: 20px; color: #2b6cb0; text-transform: uppercase; letter-spacing: 0.5px; }
                        .header h2 { margin: 4px 0 0 0; font-size: 14px; color: #4a5568; font-weight: 500; }
                        .meta { margin-bottom: 15px; display: flex; justify-content: space-between; font-size: 12px; color: #4a5568; flex-wrap: wrap; }
                        .meta-item { margin-bottom: 4px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background-color: #edf2f7; color: #2d3748; font-weight: bold; border: 1px solid #cbd5e0; padding: 8px; font-size: 11px; text-transform: uppercase; }
                        td { border: 1px solid #e2e8f0; padding: 6px 8px; }
                        tr:nth-child(even) { background-color: #f7fafc; }
                        .total-row td { font-weight: bold; font-size: 13px; background-color: #ebf8ff; }
                        .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
                        .signature-block { text-align: center; width: 45%; }
                        .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 12px; color: #4a5568; }
                        .signature-label { font-weight: bold; margin-bottom: 5px; }
                        .footer { margin-top: 20px; padding: 10px; background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; text-align: center; font-size: 11px; color: #718096; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>CENTRO DE VIDA SANA</h1>
                        <h2>ÓRDEN DE COMPRA</h2>
                    </div>
                    <div class="meta">
                        <div class="meta-item"><strong>N° de Orden:</strong> ${orden.id}</div>
                        <div class="meta-item"><strong>Proveedor:</strong> ${orden.proveedor}</div>
                        <div class="meta-item"><strong>Fecha de Emisión:</strong> ${fechaEmision}</div>
                        <div class="meta-item"><strong>Estado:</strong> ${orden.estado}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Cantidad</th>
                                <th>Descripción</th>
                                <th>Costo</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHTML}
                            <tr class="total-row">
                                <td colspan="4" style="text-align:right;">TOTAL:</td>
                                <td style="text-align:right;">$${orden.total.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="signatures">
                        <div class="signature-block">
                            <div class="signature-label">SOLICITA</div>
                            <div class="signature-line">${orden.solicita || ''}</div>
                        </div>
                        <div class="signature-block">
                            <div class="signature-label">AUTORIZA</div>
                            <div class="signature-line">${orden.autoriza || ''}</div>
                        </div>
                    </div>
                    <div class="footer">
                        Centro de Vida Sana - Órden de Compra #${orden.id} - Generado automáticamente
                    </div>
                </body>
            </html>
        `);

        ventana.document.close();
        ventana.focus();
        setTimeout(() => {
            ventana.print();
            ventana.close();
        }, 300);

    } catch (error) {
        console.error('Error al imprimir orden:', error);
        showToast('Error', 'No se pudo imprimir la orden', 'error');
    }
}

function limpiarOrden() {
    ordenDetalles = [];
    renderOrdenDetalles();

    const proveedorSelect = document.getElementById('orden-proveedor');
    const solicitaInput = document.getElementById('orden-solicita');
    const autorizaInput = document.getElementById('orden-autoriza');

    if (proveedorSelect) proveedorSelect.value = '';
    if (solicitaInput) solicitaInput.value = '';
    if (autorizaInput) autorizaInput.value = '';

    const productoSelect = document.getElementById('orden-producto');
    if (productoSelect) productoSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
}

// =====================================
// PROVEEDORES
// =====================================

function mostrarModalNuevoProveedor() {
    document.getElementById('nuevo-proveedor-nombre').value = '';
    document.getElementById('nuevo-proveedor-contacto').value = '';
    document.getElementById('nuevo-proveedor-telefono').value = '';
    document.getElementById('nuevo-proveedor-modal').classList.add('active');
}

function cerrarModalNuevoProveedor() {
    document.getElementById('nuevo-proveedor-modal').classList.remove('active');
}

async function guardarNuevoProveedor() {
    const nombre = document.getElementById('nuevo-proveedor-nombre').value.trim();
    const contacto = document.getElementById('nuevo-proveedor-contacto').value.trim();
    const telefono = document.getElementById('nuevo-proveedor-telefono').value.trim();

    if (!nombre) {
        showToast('Campo Requerido', 'Ingresa el nombre del proveedor', 'warning');
        return;
    }

    try {
        const response = await apiFetch('/api/proveedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, contacto, telefono })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Proveedor Guardado', `Proveedor "${nombre}" registrado exitosamente`, 'success');
            cerrarModalNuevoProveedor();
            await loadProveedores();

            const select = document.getElementById('orden-proveedor');
            if (select) select.value = nombre;
        } else {
            showToast('Error', data.error || 'No se pudo guardar el proveedor', 'error');
        }
    } catch (error) {
        console.error('Error al guardar proveedor:', error);
        showToast('Error de Conexión', 'No se pudo guardar el proveedor', 'error');
    }
}

function renderOrdenes() {
    const tbody = document.getElementById('ordenes-body');
    if (!tbody) return;

    if (ordenesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay órdenes registradas</td></tr>';
        return;
    }

    tbody.innerHTML = ordenesList.map(orden => {
        const estadoBadge = orden.estado === 'APROBADA' ? 'badge badge-success' :
                           orden.estado === 'RECHAZADA' ? 'badge badge-danger' :
                           orden.estado === 'RECIBIDA' ? 'badge badge-info' :
                           'badge badge-warning';

        return `
            <tr>
                <td>${orden.id}</td>
                <td>${orden.proveedor}</td>
                <td>${orden.fecha}</td>
                <td>${orden.solicita}</td>
                <td>${orden.autoriza}</td>
                <td class="text-right">${formatCurrency(orden.total)}</td>
                <td><span class="${estadoBadge}">${orden.estado}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="verOrden(${orden.id})">
                        👁️ Ver
                    </button>
                    ${orden.estado === 'PENDIENTE' ? `
                        <button class="btn btn-sm btn-success" onclick="cambiarEstadoOrden(${orden.id}, 'APROBADA')">
                            ✅ Aprobar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="cambiarEstadoOrden(${orden.id}, 'RECHAZADA')">
                            ❌ Rechazar
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-primary" onclick="imprimirOrden(${orden.id})">
                        🖨️ Imprimir
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function verOrden(id) {
    try {
        const res = await apiFetch(`/api/ordenes/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        const orden = data.orden;
        const detalles = window.ensureArray(data, 'detalles');

        const fechaEmision = new Date(orden.fecha).toLocaleString('es-MX', {
            timeZone: 'America/Mexico_City',
            hour12: true
        });

        let filasHTML = detalles.map((d, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${d.cantidad}</td>
                <td>${d.descripcion}</td>
                <td class="text-right">$${d.costo.toFixed(2)}</td>
                <td class="text-right">$${d.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        const modalHTML = `
            <div id="modal-ver-orden" class="modal" style="display: flex;">
                <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h3>Órden de Compra #${orden.id}</h3>
                        <button class="modal-close" onclick="cerrarModalVerOrden()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Proveedor:</strong> ${orden.proveedor}</p>
                        <p><strong>Fecha:</strong> ${fechaEmision}</p>
                        <p><strong>Solicita:</strong> ${orden.solicita || 'N/A'}</p>
                        <p><strong>Autoriza:</strong> ${orden.autoriza || 'N/A'}</p>
                        <p><strong>Estado:</strong> ${orden.estado}</p>
                        <div class="table-responsive">
                            <table class="modern-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Cantidad</th>
                                        <th>Descripción</th>
                                        <th>Costo</th>
                                        <th>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>${filasHTML}</tbody>
                            </table>
                        </div>
                        <p style="text-align: right; font-weight: bold; font-size: 14px; margin-top: 10px;">
                            Total: ${formatCurrency(orden.total)}
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cerrarModalVerOrden()">Cerrar</button>
                        <button class="btn btn-primary" onclick="imprimirOrden(${orden.id}); cerrarModalVerOrden();">
                            🖨️ Imprimir
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('Error al ver orden:', error);
        showToast('Error', 'No se pudo cargar la orden', 'error');
    }
}

function cerrarModalVerOrden() {
    const modal = document.getElementById('modal-ver-orden');
    if (modal) {
        modal.remove();
    }
}

async function cambiarEstadoOrden(id, estado) {
    try {
        const res = await apiFetch(`/api/ordenes/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Estado Actualizado', `Orden #${id} ahora está ${estado}`, 'success');
            loadOrdenes();
        } else {
            showToast('Error', data.error || 'No se pudo cambiar el estado', 'error');
        }
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        showToast('Error de Conexión', 'No se pudo conectar con el servidor', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('ordenes_compra');
    loadProveedores();
    loadOrdenes();

    const proveedorSelect = document.getElementById('orden-proveedor');
    if (proveedorSelect) {
        proveedorSelect.addEventListener('change', function() {
            if (this.value === '__nuevo__') {
                mostrarModalNuevoProveedor();
                this.value = '';
                return;
            }
            loadProductosByProveedor(this.value);
        });
    }
});