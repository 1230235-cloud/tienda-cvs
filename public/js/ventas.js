let productos = [];
let carrito = [];
let ventaActual = null;

// Cargar productos
async function loadProductos() {
    try {
        const response = await fetch('/api/inventario');
        productos = await response.json();
        
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
        card.className = `producto-card ${producto.stock <= producto.stock_minimo ? 'stock-bajo' : ''}`;
        card.innerHTML = `
            <div class="producto-nombre">${producto.nombre}</div>
            <div class="producto-precio">${formatCurrency(producto.precio)}</div>
            <div class="producto-stock">Stock: ${producto.stock}</div>
        `;
        card.onclick = () => agregarAlCarrito(producto);
        grid.appendChild(card);
    });
}

// Agregar al carrito
function agregarAlCarrito(producto) {
    if (producto.stock <= 0) {
        alert('No hay stock disponible');
        return;
    }
    
    const existente = carrito.find(item => item.producto_id === producto.id);
    if (existente) {
        if (existente.cantidad >= producto.stock) {
            alert('No hay suficiente stock');
            return;
        }
        existente.cantidad++;
        existente.subtotal = existente.cantidad * existente.precio_unitario;
    } else {
        carrito.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            codigo: producto.codigo,
            cantidad: 1,
            precio_unitario: producto.precio,
            subtotal: producto.precio
        });
    }
    
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
                <td>${formatCurrency(item.precio_unitario)}</td>
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
    
    if (delta > 0 && item.cantidad >= producto.stock) {
        alert('No hay suficiente stock');
        return;
    }
    
    item.cantidad += delta;
    if (item.cantidad <= 0) {
        carrito.splice(index, 1);
    } else {
        item.subtotal = item.cantidad * item.precio_unitario;
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
                <td>${formatCurrency(item.precio_unitario)}</td>
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
            precio_unitario: item.precio_unitario
        })),
        metodo_pago: document.getElementById('metodo-pago').value,
        cliente: document.getElementById('cliente').value.trim() || 'PÚBLICO GENERAL',
        usuario: usuarioNombre
    };
    
    try {
        const response = await fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(venta)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast('¡Venta Exitosa!', `Venta ${result.folio} procesada por ${formatCurrency(result.total)}`, 'success');
            
            const detalleResponse = await fetch(`/api/ventas/${result.id}`);
            if (!detalleResponse.ok) {
                throw new Error('Error al cargar detalles de la venta');
            }
            ventaActual = await detalleResponse.json();
            
            mostrarTicket();
            
            limpiarCarrito();
            document.getElementById('buscar-producto-venta').value = '';
            document.getElementById('productos-grid').style.display = 'none';
            document.getElementById('btn-regresar-busqueda').style.display = 'none';
            loadProductos();
            loadVentasRecientes();
        } else {
            const error = await response.json();
            showToast('Error de Venta', error.error || 'No se pudo procesar la venta', 'error');
        }
    } catch (error) {
        console.error('Error al procesar venta:', error);
        showToast('Error de Conexión', error.message || 'No se pudo conectar con el servidor', 'error');
    }
}

// Mostrar ticket
function mostrarTicket() {
    if (!ventaActual) return;
    
    const content = document.getElementById('ticket-content');
    if (!content) return;
    
    const detalles = ventaActual.detalles || [];
    const total = ventaActual.total || detalles.reduce((sum, d) => sum + (d.subtotal || 0), 0);
    
    if (detalles.length === 0) {
        content.innerHTML = '<p style="text-align: center; padding: 20px;" class="text-muted">No hay detalles para esta venta</p>';
    } else {
        content.innerHTML = `
            <div class="ticket-receipt">
                <div class="ticket-header" style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 15px;">
                    <img src="assets/logo.png" alt="Logo" style="max-height: 60px; margin-bottom: 5px;" onerror="this.style.display='none'">
                    <h2 style="font-size: 1.4em; margin: 0; color: #1e293b;">TIENDA CVS</h2>
                    <p style="margin: 3px 0; font-size: 0.85em; color: #64748b;">Comercio y Abarrotes de Calidad</p>
                    <div style="font-size: 0.85em; margin-top: 8px; font-family: monospace;">
                        <p style="margin: 2px 0;"><strong>Folio:</strong> ${ventaActual.folio}</p>
                        <p style="margin: 2px 0;"><strong>Fecha:</strong> ${formatDate(ventaActual.fecha)}</p>
                        <p style="margin: 2px 0;"><strong>Atendido por:</strong> ${ventaActual.usuario || 'ADMIN'}</p>
                        <p style="margin: 2px 0;"><strong>Cliente:</strong> ${ventaActual.cliente}</p>
                    </div>
                </div>

                <div class="ticket-body" style="font-family: monospace; font-size: 0.9em; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px;">
                        <span>DESCRIPCIÓN</span>
                        <span>IMPORTE</span>
                    </div>
                    ${detalles.map(detalle => `
                        <div class="ticket-item" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <div>
                                <span>${detalle.nombre || 'Producto'}</span><br>
                                <small style="color: #64748b;">${detalle.cantidad} x ${formatCurrency(detalle.precio_unitario)}</small>
                            </div>
                            <strong style="align-self: flex-end;">${formatCurrency(detalle.subtotal)}</strong>
                        </div>
                    `).join('')}
                </div>

                <div class="ticket-footer" style="border-top: 2px dashed #000; padding-top: 12px; font-family: monospace;">
                    <div style="display: flex; justify-content: space-between; font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">
                        <span>TOTAL A PAGAR:</span>
                        <span style="color: #2563eb;">${formatCurrency(total)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #64748b; margin-bottom: 12px;">
                        <span>Método de Pago:</span>
                        <span>${ventaActual.metodo_pago || 'EFECTIVO'}</span>
                    </div>
                    <p style="text-align: center; font-size: 0.85em; margin: 0; color: #475569;">
                        ¡Gracias por su compra en Tienda CVS!<br>
                        Conserve este ticket para cualquier aclaración.
                    </p>
                </div>
            </div>
        `;
    }
    
    const modal = document.getElementById('ticket-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('ticket-modal').classList.remove('active');
}

// Imprimir ticket
function imprimirTicket() {
    const ticketContent = document.getElementById('ticket-content');
    if (!ticketContent || !ticketContent.innerHTML) {
        alert('No hay contenido del ticket para imprimir');
        return;
    }
    
    const content = ticketContent.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('No se pudo abrir la ventana de impresión. Verifica que no esté bloqueada por el navegador.');
        return;
    }
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Ticket de Venta</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; width: 300px; margin: 0 auto; }
                .ticket-header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px dashed #000; }
                .ticket-body { margin: 20px 0; }
                .ticket-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #ccc; }
                .ticket-footer { margin-top: 20px; padding-top: 15px; border-top: 2px dashed #000; text-align: center; }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    
    printWindow.onload = function() {
        printWindow.print();
    };
}

// Cargar ventas recientes
async function loadVentasRecientes() {
    try {
        const response = await fetch('/api/ventas');
        const ventas = await response.json();
        
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
                <td>${formatDate(venta.fecha)}</td>
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
        const response = await fetch(`/api/ventas/${id}`);
        ventaActual = await response.json();
        mostrarTicket();
    } catch (error) {
        console.error('Error al cargar venta:', error);
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
