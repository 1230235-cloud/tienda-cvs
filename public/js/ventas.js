let productos = [];
let carrito = [];
let ventaActual = null;

// Cargar productos
async function loadProductos() {
    try {
        const response = await apiFetch('/api/inventario');
        const data = await response.json();
        productos = window.ensureArray(data, 'productos');
        
        const buscarInput = document.getElementById('buscar-producto-venta');
        const termino = buscarInput.value.toLowerCase().trim();
        
        if (termino === '') {
            document.getElementById('productos-grid').style.display = 'none';
            document.getElementById('btn-regresar-busqueda').style.display = 'none';
        } else {
            const filtrados = productos.filter(p => 
                p.codigo.toLowerCase().includes(termino) || 
                p.nombre.toLowerCase().includes(termino)
            );
            renderProductosGrid(filtrados);
            document.getElementById('productos-grid').style.display = 'grid';
            document.getElementById('btn-regresar-busqueda').style.display = 'inline-flex';
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

// Renderizar grid de productos
function renderProductosGrid(productosList) {
    const grid = document.getElementById('productos-grid');
    grid.innerHTML = '';
    
    if (productosList.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No hay productos disponibles</p>';
        return;
    }
    
    productosList.forEach(producto => {
        const card = document.createElement('div');
        card.className = `producto-card ${getStockProducto(producto) <= (producto.stock_minimo || 5) ? 'stock-bajo' : ''}`;
        const precioMostrado = getPrecioMostrado(producto);
        card.innerHTML = `
            <div class="producto-nombre">${producto.nombre}</div>
            <div class="producto-precio">${formatCurrency(precioMostrado)}</div>
            <div class="producto-stock">Stock: ${getStockProducto(producto)}</div>
        `;
        card.onclick = () => agregarAlCarrito(producto);
        grid.appendChild(card);
    });
}

// Agregar al carrito
function agregarAlCarrito(producto) {
    const stock = getStockProducto(producto);
    if (stock <= 0) {
        alert('No hay stock disponible');
        return;
    }
    
    const existente = carrito.find(item => item.producto_id === producto.id);
    if (existente) {
        if (existente.cantidad >= stock) {
            alert('No hay suficiente stock');
            return;
        }
        existente.cantidad++;
        existente.subtotal = existente.cantidad * existente.precio;
    } else {
        const precio = getPrecioProducto(producto);
        carrito.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            codigo: producto.codigo,
            cantidad: 1,
            precio: precio,
            precio_publico: Number(producto.precio_publico || producto.precio || 0),
            precio_cvs: Number(producto.precio_cvs || 0),
            subtotal: precio
        });
    }
    
    renderCarrito();
}

// Obtener stock total con fallbacks
function getStockProducto(producto) {
    if (producto.stock_total !== undefined) return producto.stock_total;
    if (producto.stock !== undefined && producto.stock !== null) return producto.stock;
    const bodega = parseInt(producto.stock_bodega) || 0;
    const tienda = parseInt(producto.stock_tienda) || 0;
    if (bodega > 0 || tienda > 0) return bodega + tienda;
    return producto.existencia ?? producto.cantidad ?? 0;
}

// Obtener precio según tipo de cliente
function getPrecioProducto(producto) {
    const tipoCliente = window.tipoClienteActual || document.getElementById('tipo-cliente')?.value || 'PUBLICO';
    if (tipoCliente === 'CVS' && Number(producto.precio_cvs) > 0) {
        return Number(producto.precio_cvs);
    }
    return Number(producto.precio_publico || producto.precio || 0);
}

// Obtener precio para mostrar en el grid
function getPrecioMostrado(producto) {
    return getPrecioProducto(producto);
}

// Actualizar precios del carrito al cambiar tipo de cliente
function actualizarPreciosCarrito(tipoCliente) {
    tipoCliente = tipoCliente || window.tipoClienteActual || document.getElementById('tipo-cliente')?.value || 'PUBLICO';
    const esCVS = tipoCliente === 'CVS' || tipoCliente.includes('CVS');
    carrito.forEach(item => {
        const nuevoPrecio = esCVS && item.precio_cvs && Number(item.precio_cvs) > 0
                            ? Number(item.precio_cvs)
                            : Number(item.precio_publico || item.precio);
        item.precio = nuevoPrecio;
        item.subtotal = item.precio * item.cantidad;
    });
    renderCarrito();
}

// Renderizar carrito
function renderCarrito() {
    const tbody = document.getElementById('carrito-body');
    const container = document.getElementById('carrito-table-container');
    tbody.innerHTML = '';
    
    if (carrito.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;" class="text-muted">Carrito de venta vacío</td></tr>';
        if (container) container.style.display = 'none';
    } else {
        if (container) container.style.display = 'block';
        carrito.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.nombre}</strong><br><small class="text-muted">${item.codigo}</small></td>
                <td>
                    <div class="quantity-controls">
                        <button class="btn btn-xs btn-secondary" onclick="cambiarCantidad(${index}, -1)">-</button>
                        <span class="qty-display">${item.cantidad}</span>
                        <button class="btn btn-xs btn-secondary" onclick="cambiarCantidad(${index}, 1)">+</button>
</div>
                 </td>
                 <td>${formatCurrency(item.precio)}</td>
                 <td><strong>${formatCurrency(item.subtotal)}</strong></td>
                <td><button class="btn btn-sm btn-danger-icon" onclick="eliminarDelCarrito(${index})" title="Eliminar">🗑️</button></td>
            `;
            tbody.appendChild(row);
        });
    }
    
    actualizarTotales();
}

// Cambiar cantidad
function cambiarCantidad(index, delta) {
    const item = carrito[index];
    const producto = productos.find(p => p.id === item.producto_id);
    const stock = getStockProducto(producto);
    
    if (delta > 0 && item.cantidad >= stock) {
        alert('No hay suficiente stock');
        return;
    }
    
    item.cantidad += delta;
    if (item.cantidad <= 0) {
        carrito.splice(index, 1);
    } else {
        item.subtotal = item.precio * item.cantidad;
    }
    
    renderCarrito();
}

// Eliminar del carrito
function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    renderCarrito();
}

// Actualizar totales
function actualizarTotales() {
    const subtotal = carrito.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal;  // SIN IVA
    
    // Actualizar elemento del total
    document.getElementById('total').textContent = formatCurrency(total);
    
    // Actualizar vista previa del carrito en el header
    document.getElementById('carrito-count').textContent = carrito.length;
    document.getElementById('total-carrito-preview').textContent = formatCurrency(total);
}

// Abrir carrito en modal flotante
function abrirCarritoModal() {
    if (carrito.length === 0) {
        showNotification('El carrito está vacío', 'warning');
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    const total = carrito.reduce((sum, item) => sum + item.subtotal, 0);
    
    carrito.forEach((item, index) => {
        html += `
            <tr>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.cantidad}</td>
                <td>${formatCurrency(item.precio)}</td>
                <td>${formatCurrency(item.subtotal)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="eliminarDelCarrito(${index}); closeModal();">Eliminar</button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div style="margin-top: 20px; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: right;">
            <p style="font-size: 1.2em; margin: 0;"><strong>Total: ${formatCurrency(total)}</strong></p>
        </div>
    `;
    
    const footer = `
        <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-danger" onclick="limpiarCarrito(); closeModal();">Vaciar Carrito</button>
        <button class="btn btn-primary btn-lg" onclick="closeModal(); procesarVenta();">🛍️ Procesar Venta</button>
    `;
    
    createModal('🛒 Carrito de Compra', html, footer);
}

// Limpiar carrito
function limpiarCarrito() {
    carrito = [];
    renderCarrito();
}

// Procesar venta
async function procesarVenta() {
    if (carrito.length === 0) {
        showToast('Carrito Vacío', 'Agrega al menos un producto al carrito para realizar la venta.', 'warning');
        return;
    }
    
    const user = loadUserInfo();
    const usuarioNombre = user.nombre || user.username || 'ADMIN';

    const venta = {
        productos: carrito.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio
        })),
        metodo_pago: document.getElementById('metodo-pago').value,
        tipo_cliente: document.getElementById('tipo-cliente').value,
        cliente: document.getElementById('cliente').value.trim() || 'PÚBLICO GENERAL',
        precio_final: carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0),
        usuario: usuarioNombre,
        pagoCon: parseFloat(document.getElementById('pago-con')?.value) || 0,
        cambio: parseFloat(document.getElementById('cambio')?.value) || 0
    };
    
    try {
        const response = await apiFetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(venta)
        });
        
        if (response.ok) {
            const data = await response.json();
            showToast('¡Venta Exitosa!', `Venta ${data.folio} procesada por ${formatCurrency(data.total)}`, 'success');
            
            limpiarCarrito();
            document.getElementById('buscar-producto-venta').value = '';
            document.getElementById('productos-grid').style.display = 'none';
            document.getElementById('btn-regresar-busqueda').style.display = 'none';
            loadProductos();
            loadVentasRecientes();
            
            if (typeof imprimirTicket === 'function') {
                imprimirTicket(data.ventaId);
            }
        } else {
            const error = await response.json();
            showToast('Error de Venta', error.error || 'No se pudo procesar la venta', 'error');
        }
    } catch (error) {
        console.error('Error al procesar venta:', error);
        showToast('Error de Conexión', error.message || 'No se pudo conectar con el servidor', 'error');
    }
}

// Mostrar ticket en modal
function mostrarTicket() {
    if (!ventaActual) return;
    
    const content = document.getElementById('ticket-content');
    if (!content) return;
    
    const detalles = ventaActual.detalles || [];
    const total = ventaActual.total || detalles.reduce((sum, d) => sum + (d.subtotal || 0), 0);
    const metodoPago = ventaActual.metodo_pago || 'EFECTIVO';
    const folio = ventaActual.folio || '';
    const fecha = formatearFechaLocal(new Date());
    const cajero = ventaActual.usuario || 'ADMIN';
    const cliente = ventaActual.cliente || 'PÚBLICO GENERAL';

let itemsHTML = '';
    detalles.forEach(detalle => {
        itemsHTML += `
        <tr>
            <td class="col-cant">${detalle.cantidad}</td>
            <td class="col-desc">${detalle.nombre || 'Producto'}</td>
            <td class="col-importe">${formatCurrency(detalle.subtotal)}</td>
        </tr>`;
    });

    const clienteNombre = ventaActual.cliente || 'PÚBLICO GENERAL';

    content.innerHTML = `
        <div class="ticket-container">
            <div class="header text-center">
                <h1>CENTRO DE VIDA SANA</h1>
                <p>FILIBERTO VERDUZCO AVILA</p>
                <p>19A PONIENTE SUR, LIBRAMIENTO SUR</p>
                <p>961 575 7310</p>
                <p>RFC: CVS2210111B0</p>
            </div>
            <div class="datetime-row">
                <span>${fecha}</span>
            </div>
            <table class="meta-table">
                <tr>
                    <td style="width: 25%;">CAJERO:</td>
                    <td class="text-right">${cajero}</td>
                </tr>
                <tr>
                    <td>FOLIO:</td>
                    <td class="text-right">${folio}</td>
                </tr>
                <tr>
                    <td>FORMA PAGO:</td>
                    <td class="text-right">${metodoPago}</td>
                </tr>
                <tr>
                    <td>CLIENTE:</td>
                    <td class="text-right">${clienteNombre}</td>
                </tr>
            </table>
            <table class="ticket-table">
                <thead>
                    <tr>
                        <th class="col-cant">CANT.</th>
                        <th class="col-desc">DESCRIPCION</th>
                        <th class="col-importe">IMPORTE</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
            <div class="summary-section">
                NO. DE ARTICULOS: ${detalles.length}
            </div>
            <table class="totals-table">
                <tr>
                    <td class="text-right" style="width: 55%;">TOTAL:</td>
                    <td class="text-right" style="width: 45%;">${formatCurrency(total)}</td>
                </tr>
            </table>
            <div class="footer text-center">
                <p>GRACIAS POR SU COMPRA</p>
                <p>WWW.ABARROTESPUNTODEVENTA.COM</p>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('ticket-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('ticket-modal').classList.remove('active');
}

// Imprimir ticket (soporta 80mm térmico y A4 normal)
async function imprimirTicket(ventaId, tipoImpresora = 'tickets') {
    try {
        const response = await apiFetch(`/api/ventas/${ventaId}`);
        if (!response.ok) {
            alert('No se pudo cargar el detalle de la venta para imprimir');
            return;
        }
        const venta = await response.json();

        const detalles = venta.detalles || [];
        const total = venta.total || detalles.reduce((sum, d) => sum + (d.subtotal || 0), 0);
        const metodoPago = venta.metodo_pago || 'EFECTIVO';
        const folio = venta.folio || String(venta.id);
        const fecha = formatearFechaLocal(new Date());
        const cajero = venta.usuario || 'ADMIN';
        const cliente = venta.cliente || 'PÚBLICO GENERAL';

        let itemsHTML = '';
        detalles.forEach(detalle => {
            itemsHTML += `
            <tr>
                <td class="col-cant">${detalle.cantidad}</td>
                <td class="col-desc">${detalle.nombre || 'Producto'}</td>
                <td class="col-importe">${formatCurrency(detalle.subtotal)}</td>
            </tr>`;
        });

        const clienteNombre = venta.cliente || 'PÚBLICO GENERAL';

        const esA4 = tipoImpresora === 'normal';
        const pageSize = esA4 ? 'A4' : '80mm auto';
        const pageMargin = esA4 ? '15mm' : '0';
        const bodyWidth = esA4 ? '100%' : '76mm';
        const maxWidth = esA4 ? '100%' : '300px';
        const fontSize = esA4 ? '12pt' : '11pt';

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Ticket de Venta</title>
    <style>
        @media print {
            @page {
                size: ${pageSize};
                margin: ${pageMargin};
            }
        }
        body {
            width: ${bodyWidth};
            margin: 0 auto;
            padding: ${esA4 ? '20px' : '5px 0'};
            font-family: ${esA4 ? "'Helvetica Neue', Arial, sans-serif" : "'Courier New', Courier, monospace"};
            font-size: ${fontSize};
            color: #000;
            background: #fff;
            line-height: 1.5;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }

        .ticket-container {
            width: 100% !important;
            max-width: ${maxWidth} !important;
            margin: 0 auto !important;
            font-family: ${esA4 ? "'Helvetica Neue', Arial, sans-serif" : "'Courier New', Courier, monospace"} !important;
            font-size: ${esA4 ? '13px' : '12px'} !important;
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

        .summary-section {
            text-align: center;
            font-size: 10.5pt;
            margin-bottom: 10px;
        }

        .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12.5pt;
            font-weight: bold;
            margin-bottom: 12px;
        }
        .totals-table td { padding: 2px 0; }

        .footer {
            margin-top: 12px;
            font-size: 9pt;
        }
        .footer p { margin: 2px 0; }
    </style>
</head>
<body>

    <div class="ticket-container">
        <div class="header text-center">
            <h1>CENTRO DE VIDA SANA</h1>
            <p>FILIBERTO VERDUZCO AVILA</p>
            <p>19A PONIENTE SUR, LIBRAMIENTO SUR</p>
            <p>961 575 7310</p>
            <p>RFC: CVS2210111B0</p>
        </div>

        <div class="datetime-row">
            <span>${fecha}</span>
        </div>

        <table class="meta-table">
            <tr>
                <td style="width: 25%;">CAJERO:</td>
                <td class="text-right">${cajero}</td>
            </tr>
            <tr>
                <td>FOLIO:</td>
                <td class="text-right">${folio}</td>
            </tr>
            <tr>
                <td>FORMA PAGO:</td>
                <td class="text-right">${metodoPago}</td>
            </tr>
            <tr>
                <td>CLIENTE:</td>
                <td class="text-right">${clienteNombre}</td>
            </tr>
            <tr>
                <td>TIPO:</td>
                <td class="text-right">${venta.tipo_cliente === 'CVS' ? 'Cliente CVS' : 'Público General'}</td>
            </tr>
        </table>

        <table class="ticket-table">
            <thead>
                <tr>
                    <th class="col-cant">CANT.</th>
                    <th class="col-desc">DESCRIPCION</th>
                    <th class="col-importe">IMPORTE</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>

        <div class="summary-section">
            NO. DE ARTICULOS: ${detalles.length}
        </div>

        <table class="totals-table">
            <tr>
                <td class="text-right" style="width: 55%;">TOTAL:</td>
                <td class="text-right" style="width: 45%;">${formatCurrency(total)}</td>
            </tr>
        </table>

        <div class="footer text-center">
            <p>GRACIAS POR SU COMPRA</p>
            <p>WWW.ABARROTESPUNTODEVENTA.COM</p>
        </div>
    </div>

</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=300,height=600');
        if (!printWindow) {
            alert('No se pudo abrir la ventana de impresión. Verifica que no esté bloqueada por el navegador.');
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();

        printWindow.onload = function() {
            printWindow.print();
        };
    } catch (error) {
        console.error('Error al imprimir ticket:', error);
    }
}

async function imprimirVentasDelDia() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const inicioHoy = `${hoy}T00:00:00.000Z`;
        const finHoy = `${hoy}T23:59:59.999Z`;

        const response = await apiFetch(`/api/ventas/fecha/${encodeURIComponent(inicioHoy)}/${encodeURIComponent(finHoy)}`);
        if (!response.ok) {
            alert('No se pudieron cargar las ventas del día');
            return;
        }
        const data = await response.json();
        const ventas = window.ensureArray(data, 'ventas');

        if (ventas.length === 0) {
            alert('No hay ventas registradas para el día de hoy');
            return;
        }

        const fechaEmision = new Date().toLocaleString('es-MX', {
            timeZone: 'America/Mexico_City',
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        let filasHTML = ventas.map((v, index) => {
            const hora = new Date(v.fecha).toLocaleTimeString('es-MX', {
                timeZone: 'America/Mexico_City',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const cliente = v.cliente || 'PÚBLICO GENERAL';
            const tipoCliente = v.tipo_cliente === 'CVS' ? 'CVS' : 'PUBLICO';

            return `
                <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td style="text-align:center;">${v.folio || v.id}</td>
                    <td style="text-align:center;">${hora}</td>
                    <td>${cliente}</td>
                    <td style="text-align:center;">${tipoCliente}</td>
                    <td style="text-align:right;">$${(v.total || 0).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const totalEfectivo = ventas.filter(v => v.metodo_pago === 'EFECTIVO').reduce((s, v) => s + (v.total || 0), 0);
        const totalTarjeta = ventas.filter(v => v.metodo_pago === 'TARJETA').reduce((s, v) => s + (v.total || 0), 0);
        const totalTransferencia = ventas.filter(v => v.metodo_pago === 'TRANSFERENCIA').reduce((s, v) => s + (v.total || 0), 0);
        const totalGeneral = ventas.reduce((s, v) => s + (v.total || 0), 0);

        const ventana = window.open('', '', 'height=800,width=950');
        ventana.document.write(`
            <html>
                <head>
                    <title>Ventas del Día - Tienda CVS</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 25px; color: #1a202c; font-size: 12px; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 10px; }
                        .header h1 { margin: 0; font-size: 20px; color: #2b6cb0; text-transform: uppercase; letter-spacing: 0.5px; }
                        .header h2 { margin: 4px 0 0 0; font-size: 14px; color: #4a5568; font-weight: 500; }
                        .meta { margin-bottom: 15px; display: flex; justify-content: space-between; font-size: 12px; color: #4a5568; }
                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background-color: #edf2f7; color: #2d3748; font-weight: bold; border: 1px solid #cbd5e0; padding: 8px; font-size: 11px; text-transform: uppercase; }
                        td { border: 1px solid #e2e8f0; padding: 6px 8px; }
                        tr:nth-child(even) { background-color: #f7fafc; }
                        .totals-section { margin-top: 20px; padding: 12px; background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 4px; }
                        .totals-section table { width: 100%; }
                        .totals-section td { border: none; padding: 4px 8px; }
                        .total-row td { font-weight: bold; font-size: 13px; background-color: #bee3f8; }
                        @page { margin: 5mm; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>CENTRO DE VIDA SANA</h1>
                        <h2>REPORTE DE VENTAS DEL DÍA</h2>
                    </div>
                    <div class="meta">
                        <span><strong>Fecha de Reporte:</strong> ${fechaEmision}</span>
                        <span><strong>Total de Ventas:</strong> ${ventas.length}</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:5%;">#</th>
                                <th style="width:15%;">N° TICKET</th>
                                <th style="width:15%;">HORA</th>
                                <th style="width:30%;">CLIENTE</th>
                                <th style="width:15%;">TIPO</th>
                                <th style="width:20%;">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHTML}
                        </tbody>
                    </table>
                    <div class="totals-section">
                        <table>
                            <tr>
                                <td style="width:50%;"><strong>Efectivo:</strong></td>
                                <td style="width:50%; text-align:right;">$${totalEfectivo.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                                <td><strong>Tarjeta:</strong></td>
                                <td style="text-align:right;">$${totalTarjeta.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                                <td><strong>Transferencia:</strong></td>
                                <td style="text-align:right;">$${totalTransferencia.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            <tr class="total-row">
                                <td><strong>GRAN TOTAL:</strong></td>
                                <td style="text-align:right;"><strong>$${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                            </tr>
                        </table>
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
        console.error('Error al imprimir ventas del día:', error);
        alert('Error al generar el reporte de ventas del día');
    }
}

// Cargar ventas recientes
async function loadVentasRecientes() {
    try {
        const response = await apiFetch('/api/ventas');
        const data = await response.json();
        const ventas = window.ensureArray(data, 'ventas');
        
        const tbody = document.getElementById('ventas-recientes-body');
        tbody.innerHTML = '';
        
        if (ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay ventas registradas</td></tr>';
            return;
        }
        
        ventas.slice(0, 10).forEach(venta => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${venta.folio}</td>
                <td>${formatearFechaLocal(venta.fecha)}</td>
                <td>${venta.cliente}</td>
                <td>${formatCurrency(venta.total)}</td>
                <td>${venta.metodo_pago}</td>
                <td><span style="color: ${venta.estado === 'COMPLETADA' ? 'green' : 'red'}">${venta.estado}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="verTicket(${venta.id})">🧾 Ticket</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar ventas recientes:', error);
    }
}

// Ver ticket de venta existente
async function verTicket(id) {
    try {
        const response = await apiFetch(`/api/ventas/${id}`);
        if (!response.ok) {
            showToast('Error', 'No se pudo cargar el detalle de la venta', 'error');
            return;
        }
        ventaActual = await response.json();
        mostrarTicket();
    } catch (error) {
        console.error('Error al cargar venta:', error);
        showToast('Error de Conexión', 'No se pudo cargar el detalle de la venta', 'error');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    loadProductos();
    loadVentasRecientes();
    
    // Ocultar grid de productos inicialmente
    document.getElementById('productos-grid').style.display = 'none';
    document.getElementById('btn-regresar-busqueda').style.display = 'none';
    
    document.getElementById('buscar-producto-venta').addEventListener('input', buscarProducto);
    
    // Actualizar precios del carrito al cambiar tipo de cliente
    const tipoClienteSelect = document.getElementById('tipo-cliente');
    if (tipoClienteSelect) {
        tipoClienteSelect.addEventListener('change', (e) => {
            window.tipoClienteActual = e.target.value;
            actualizarPreciosCarrito(e.target.value);
            const buscarInput = document.getElementById('buscar-producto-venta');
            if (buscarInput && buscarInput.value.trim()) {
                buscarProducto();
            }
        });
    }
    
    // Permitir agregar con Enter en el buscador
    document.getElementById('buscar-producto-venta').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const termino = e.target.value.toLowerCase();
            const producto = productos.find(p => 
                p.codigo.toLowerCase() === termino || 
                p.nombre.toLowerCase() === termino
            );
            if (producto) {
                agregarAlCarrito(producto);
                regresarBusqueda();
            }
        }
    });
});

// Regresar / limpiar búsqueda
function regresarBusqueda() {
    document.getElementById('buscar-producto-venta').value = '';
    document.getElementById('productos-grid').style.display = 'none';
    document.getElementById('btn-regresar-busqueda').style.display = 'none';
}

// Buscar producto
function buscarProducto() {
    const termino = document.getElementById('buscar-producto-venta').value.toLowerCase().trim();
    const grid = document.getElementById('productos-grid');
    const btnRegresar = document.getElementById('btn-regresar-busqueda');
    
    if (termino === '') {
        grid.style.display = 'none';
        btnRegresar.style.display = 'none';
        return;
    }
    
    const filtrados = productos.filter(p => 
        p.codigo.toLowerCase().includes(termino) || 
        p.nombre.toLowerCase().includes(termino)
    );
    renderProductosGrid(filtrados);
    grid.style.display = 'grid';
    btnRegresar.style.display = 'inline-flex';
}

// =====================================
// DEVOLUCIÓN / CANCELAR VENTA
// =====================================

let ventaDevolucionTemp = null;

function mostrarModalDevolucion() {
    ventaDevolucionTemp = null;
    document.getElementById('devolucion-folio').value = '';
    document.getElementById('devolucion-info').innerHTML = '';
    document.getElementById('btn-confirmar-devolucion').style.display = 'none';
    document.getElementById('devolucion-modal').classList.add('active');
}

function cerrarModalDevolucion() {
    document.getElementById('devolucion-modal').classList.remove('active');
    ventaDevolucionTemp = null;
}

async function buscarVentaDevolucion() {
    const folioInput = document.getElementById('devolucion-folio').value.trim();
    if (!folioInput) {
        showToast('Campo Requerido', 'Ingresa un Folio o ID de venta', 'warning');
        return;
    }

    try {
        const response = await apiFetch(`/api/ventas/${encodeURIComponent(folioInput)}`);

        if (!response.ok) {
            const error = await response.json();
            showToast('Venta No Encontrada', error.error || 'No se encontró la venta', 'error');
            ventaDevolucionTemp = null;
            document.getElementById('devolucion-info').innerHTML = '';
            document.getElementById('btn-confirmar-devolucion').style.display = 'none';
            return;
        }

        ventaDevolucionTemp = await response.json();
        const detalles = ventaDevolucionTemp.detalles || [];
        const total = ventaDevolucionTemp.total || 0;
        const fecha = formatearFechaLocal(ventaDevolucionTemp.fecha);
        const cliente = ventaDevolucionTemp.cliente || 'PÚBLICO GENERAL';

        let detallesHTML = '<ul style="margin: 10px 0; padding-left: 20px;">';
        detalles.forEach(d => {
            detallesHTML += `<li>${d.nombre || 'Producto'} - Cant: ${d.cantidad} - ${formatCurrency(d.subtotal || 0)}</li>`;
        });
        detallesHTML += '</ul>';

        document.getElementById('devolucion-info').innerHTML = `
            <div class="alert alert-info">
                <strong>Folio:</strong> ${ventaDevolucionTemp.folio || folioInput}<br>
                <strong>Fecha:</strong> ${fecha}<br>
                <strong>Cliente:</strong> ${cliente}<br>
                <strong>Total:</strong> ${formatCurrency(total)}<br>
                <strong>Productos:</strong><br>
                ${detallesHTML}
            </div>
        `;
        document.getElementById('btn-confirmar-devolucion').style.display = 'inline-flex';
    } catch (error) {
        console.error('Error al buscar venta para devolución:', error);
        showToast('Error de Conexión', 'No se pudo buscar la venta', 'error');
    }
}

async function procesarDevolucion() {
    if (!ventaDevolucionTemp) {
        showToast('Error', 'Primero busca una venta válida', 'warning');
        return;
    }

    if (ventaDevolucionTemp.estado === 'CANCELADA') {
        showToast('Venta Ya Cancelada', 'Esta venta ya fue cancelada anteriormente', 'warning');
        return;
    }

    if (!confirm(`¿Estás seguro de cancelar la venta ${ventaDevolucionTemp.folio}? El inventario se restablecerá.`)) {
        return;
    }

    try {
        const response = await apiFetch(`/api/ventas/${ventaDevolucionTemp.id}/cancelar`, {
            method: 'PUT'
        });

        if (response.ok) {
            showToast('Devolución Exitosa', `Venta ${ventaDevolucionTemp.folio} cancelada. Inventario restablecido.`, 'success');
            cerrarModalDevolucion();
            loadProductos();
            loadVentasRecientes();
        } else {
            const error = await response.json();
            showToast('Error en Devolución', error.error || 'No se pudo procesar la devolución', 'error');
        }
    } catch (error) {
        console.error('Error al procesar devolución:', error);
        showToast('Error de Conexión', 'No se pudo conectar con el servidor', 'error');
    }
}
