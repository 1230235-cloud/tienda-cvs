// Lógica del Módulo de Entradas de Mercancía - Tienda CVS

let productosCatalogo = [];
let carritoEntrada = [];

function switchEntradaTab(tab) {
    const btnSurtir = document.getElementById('tab-btn-surtir');
    const btnNuevo = document.getElementById('tab-btn-nuevo');
    const contentSurtir = document.getElementById('tab-content-surtir');
    const contentNuevo = document.getElementById('tab-content-nuevo');

    if (tab === 'surtir') {
        btnSurtir.classList.add('active');
        btnNuevo.classList.remove('active');
        contentSurtir.style.display = 'block';
        contentNuevo.style.display = 'none';
    } else {
        btnNuevo.classList.add('active');
        btnSurtir.classList.remove('active');
        contentNuevo.style.display = 'block';
        contentSurtir.style.display = 'none';
    }
}

async function loadProductos() {
    try {
        const response = await fetch('/api/inventario');
        if (!response.ok) return;
        productosCatalogo = await response.json();

        renderProductosGrid(productosCatalogo);

        // Verificar si viene una búsqueda por URL
        const urlParams = new URLSearchParams(window.location.search);
        const buscarQuery = urlParams.get('buscar');
        if (buscarQuery) {
            document.getElementById('buscar-producto-entrada').value = buscarQuery;
            buscarProducto();
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function renderProductosGrid(lista) {
    const grid = document.getElementById('productos-grid');
    grid.innerHTML = '';

    if (!lista || lista.length === 0) {
        grid.innerHTML = '<p class="text-center text-muted full-grid">No hay productos que coincidan con la búsqueda.</p>';
        return;
    }

    lista.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'producto-card-item';
        const precioVal = parseFloat(prod.precio) || parseFloat(prod.precio_venta) || 0;
        card.innerHTML = `
            <div class="prod-code"><code>${prod.codigo}</code></div>
            <div class="prod-title">${prod.nombre}</div>
            <div class="prod-meta">
                <span class="prod-price">${formatCurrency(precioVal)}</span>
                <span class="prod-stock">Stock actual: <strong>${prod.stock}</strong></span>
            </div>
            <button class="btn btn-sm btn-outline btn-block margin-top-xs">+ Seleccionar</button>
        `;
        card.onclick = () => agregarAlCarrito(prod);
        grid.appendChild(card);
    });
}

function agregarAlCarrito(prod) {
    const existente = carritoEntrada.find(i => i.producto_id === prod.id);
    const precioBase = parseFloat(prod.precio_compra) || parseFloat(prod.precio) || 0;

    if (existente) {
        existente.cantidad += 1;
        existente.subtotal = existente.cantidad * existente.precio_compra;
    } else {
        carritoEntrada.push({
            producto_id: prod.id,
            nombre: prod.nombre,
            codigo: prod.codigo,
            cantidad: 1,
            precio_compra: precioBase,
            subtotal: precioBase
        });
    }

    renderCarrito();
}

function renderCarrito() {
    const tbody = document.getElementById('carrito-body');
    tbody.innerHTML = '';

    if (carritoEntrada.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay productos en el lote de entrada</td></tr>';
        actualizarTotal();
        return;
    }

    carritoEntrada.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${item.nombre}</strong><br>
                <small class="text-muted">${item.codigo}</small>
            </td>
            <td>
                <div class="quantity-controls">
                    <button class="btn btn-xs btn-secondary" onclick="cambiarCantidad(${index}, -1)">-</button>
                    <span class="qty-display">${item.cantidad}</span>
                    <button class="btn btn-xs btn-secondary" onclick="cambiarCantidad(${index}, 1)">+</button>
                </div>
            </td>
            <td>
                <input type="number" step="0.01" value="${item.precio_compra}" 
                       onchange="cambiarPrecio(${index}, this.value)" 
                       class="input-control input-sm input-cost">
            </td>
            <td><strong>${formatCurrency(item.subtotal)}</strong></td>
            <td>
                <button class="btn btn-sm btn-danger-icon" onclick="eliminarDelCarrito(${index})" title="Eliminar">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    actualizarTotal();
}

function cambiarCantidad(index, delta) {
    const item = carritoEntrada[index];
    item.cantidad += delta;
    if (item.cantidad <= 0) {
        carritoEntrada.splice(index, 1);
    } else {
        item.subtotal = item.cantidad * item.precio_compra;
    }
    renderCarrito();
}

function cambiarPrecio(index, valor) {
    const item = carritoEntrada[index];
    item.precio_compra = parseFloat(valor) || 0;
    item.subtotal = item.cantidad * item.precio_compra;
    renderCarrito();
}

function eliminarDelCarrito(index) {
    carritoEntrada.splice(index, 1);
    renderCarrito();
}

function actualizarTotal() {
    const total = carritoEntrada.reduce((sum, i) => sum + i.subtotal, 0);
    document.getElementById('total-entrada-monto').textContent = formatCurrency(total);
}

function limpiarCarrito() {
    carritoEntrada = [];
    renderCarrito();
}

async function procesarEntrada() {
    if (carritoEntrada.length === 0) {
        alert('Por favor selecciona al menos un producto para la entrada.');
        return;
    }

    const user = loadUserInfo();
    const payload = {
        productos: carritoEntrada.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio: item.precio_compra
        })),
        proveedor: document.getElementById('proveedor-entrada').value.trim() || 'Proveedor General',
        usuario: user.nombre || 'ADMIN',
        observaciones: document.getElementById('observaciones-entrada').value.trim()
    };

    try {
        const response = await fetch('/api/entradas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (response.ok) {
            showToast('Entrada Registrada', `Entrada de mercancía registrada exitosamente con Folio: ${resData.folio}`, 'success');
            limpiarCarrito();
            document.getElementById('observaciones-entrada').value = '';
            loadProductos();
            loadEntradasRecientes();
        } else {
            showToast('Error', resData.error || 'No se pudo procesar la entrada', 'error');
        }
    } catch (error) {
        console.error('Error al procesar entrada:', error);
        showToast('Error de Conexión', 'Ocurrió un error al guardar la entrada de mercancía', 'error');
    }
}

// ALTA DE NUEVO PRODUCTO
function generarCodigoAleatorio() {
    const randomNum = Math.floor(100000000000 + Math.random() * 900000000000);
    document.getElementById('nuevo-codigo').value = `750${randomNum.toString().slice(0, 9)}`;
}

async function guardarNuevoProducto(e) {
    e.preventDefault();
    const alertErr = document.getElementById('nuevo-prod-alert');
    const alertSucc = document.getElementById('nuevo-prod-success');
    const btnSubmit = document.getElementById('btn-guardar-nuevo');

    alertErr.style.display = 'none';
    alertSucc.style.display = 'none';
    btnSubmit.disabled = true;

    const user = loadUserInfo();
    const payload = {
        codigo: document.getElementById('nuevo-codigo').value.trim(),
        nombre: document.getElementById('nuevo-nombre').value.trim(),
        categoria: document.getElementById('nuevo-categoria').value.trim() || 'General',
        precio_venta: parseFloat(document.getElementById('nuevo-precio-venta').value),
        precio_compra: parseFloat(document.getElementById('nuevo-precio-compra').value) || parseFloat(document.getElementById('nuevo-precio-venta').value),
        cantidad: parseInt(document.getElementById('nuevo-stock-inicial').value) || 1,
        stock_minimo: parseInt(document.getElementById('nuevo-stock-minimo').value) || 5,
        proveedor: document.getElementById('nuevo-proveedor').value.trim() || 'Proveedor General',
        usuario: user.nombre || 'ADMIN',
        observaciones: document.getElementById('nuevo-observaciones').value.trim() || 'Alta de producto nuevo'
    };

    try {
        const response = await fetch('/api/entradas/crear-y-entrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            alertSucc.textContent = `✨ ¡Producto "${payload.nombre}" creado con éxito e ingresado con ${payload.cantidad} unidades! (Folio: ${data.folio})`;
            alertSucc.style.display = 'block';
            document.getElementById('form-nuevo-producto').reset();
            document.getElementById('nuevo-stock-inicial').value = 10;
            document.getElementById('nuevo-stock-minimo').value = 5;
            loadProductos();
            loadEntradasRecientes();
        } else {
            alertErr.textContent = data.error || 'Error al registrar el nuevo producto';
            alertErr.style.display = 'block';
        }
    } catch (err) {
        alertErr.textContent = 'Error de conexión al servidor';
        alertErr.style.display = 'block';
    } finally {
        btnSubmit.disabled = false;
    }
}

// Cargar Historial Reciente de Entradas
async function loadEntradasRecientes() {
    try {
        const response = await fetch('/api/entradas');
        if (!response.ok) return;
        const entradas = await response.json();

        const tbody = document.getElementById('entradas-recientes-body');
        tbody.innerHTML = '';

        if (!entradas || entradas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay entradas registradas aún.</td></tr>';
            return;
        }

        entradas.slice(0, 10).forEach(e => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><code>${e.folio}</code></td>
                <td>${formatDate(e.fecha)}</td>
                <td><strong>${e.proveedor}</strong></td>
                <td><strong>${formatCurrency(e.total)}</strong></td>
                <td><span class="user-pill">${e.usuario || 'ADMIN'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="verDetalleEntrada(${e.id})">📋 Ver Detalle</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al cargar historial de entradas:', error);
    }
}

async function verDetalleEntrada(id) {
    try {
        const response = await fetch(`/api/entradas/${id}`);
        if (!response.ok) return;
        const entrada = await response.json();

        const content = document.getElementById('detalle-content');
        content.innerHTML = `
            <div class="detail-summary-card">
                <div class="detail-grid">
                    <div><strong>Folio:</strong> <code>${entrada.folio}</code></div>
                    <div><strong>Fecha:</strong> ${formatDate(entrada.fecha)}</div>
                    <div><strong>Proveedor:</strong> ${entrada.proveedor}</div>
                    <div><strong>Usuario:</strong> ${entrada.usuario}</div>
                    <div><strong>Costo Total Entrada:</strong> <span class="text-primary text-large">${formatCurrency(entrada.total)}</span></div>
                    <div><strong>Observaciones:</strong> ${entrada.observaciones || '-'}</div>
                </div>
            </div>
            <h4 class="margin-top-md margin-bottom-xs">Artículos Ingresados</h4>
            <div class="table-responsive">
                <table class="modern-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Costo Unitario</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entrada.detalles.map(d => `
                            <tr>
                                <td><code>${d.codigo}</code></td>
                                <td><strong>${d.nombre}</strong></td>
                                <td><span class="badge badge-primary">${d.cantidad} u.</span></td>
                                <td>${formatCurrency(d.precio_compra)}</td>
                                <td><strong>${formatCurrency(d.subtotal)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('detalle-modal').classList.add('active');
    } catch (error) {
        console.error('Error al ver detalle:', error);
    }
}

function cerrarModal() {
    document.getElementById('detalle-modal').classList.remove('active');
}

function buscarProducto() {
    const termino = document.getElementById('buscar-producto-entrada').value.toLowerCase().trim();
    const filtrados = productosCatalogo.filter(p =>
        (p.codigo && p.codigo.toLowerCase().includes(termino)) ||
        (p.nombre && p.nombre.toLowerCase().includes(termino))
    );
    renderProductosGrid(filtrados);

    const btnRegresar = document.getElementById('btn-regresar-busqueda');
    if (btnRegresar) {
        btnRegresar.style.display = termino ? 'inline-flex' : 'none';
    }
}

function regresarBusqueda() {
    const input = document.getElementById('buscar-producto-entrada');
    const btnRegresar = document.getElementById('btn-regresar-busqueda');
    if (input) input.value = '';
    if (btnRegresar) btnRegresar.style.display = 'none';
    renderProductosGrid(productosCatalogo);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('entradas');
    loadProductos();
    loadEntradasRecientes();

    document.getElementById('buscar-producto-entrada').addEventListener('input', buscarProducto);
});
