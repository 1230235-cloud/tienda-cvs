// Módulo de Inventario (Consulta de productos en tienda)

let todosProductos = [];
let productosVisibles = [];
let currentTab = 'bodega';
let agregarStockProductoId = null;

async function loadProductos() {
    try {
        const response = await apiFetch('/api/inventario');
        if (!response.ok) return;
        const data = await response.json();
        todosProductos = window.ensureArray(data, 'productos');

        updateInventoryMetrics();
        populateCategoriesSelect();
        aplicarFiltros();
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function updateInventoryMetrics() {
    const totalSkus = todosProductos.length;
    let totalUnits = 0;
    let totalValue = 0;
    let lowCount = 0;

    todosProductos.forEach(p => {
        const stockBodega = parseInt(p.stock_bodega) || 0;
        const stockTienda = parseInt(p.stock_tienda) || 0;
        const stock = stockBodega + stockTienda;
        const precio = parseFloat(p.precio) || parseFloat(p.precio_venta) || 0;
        totalUnits += stock;
        totalValue += (stock * precio);
        if (stock <= (p.stock_minimo || 5)) {
            lowCount++;
        }
    });

    document.getElementById('inv-total-skus').textContent = totalSkus;
    document.getElementById('inv-total-units').textContent = totalUnits;
    document.getElementById('inv-total-value').textContent = formatCurrency(totalValue);
    document.getElementById('inv-low-count').textContent = lowCount;
}

function populateCategoriesSelect() {
    const select = document.getElementById('filtro-categoria');
    const currentVal = select.value;
    const categorias = ['Suplementos y Vitaminas', 'Ropa y Accesorios', 'Colpac', 'Agua y Suero', 'Semillas', 'Infusiones', 'Pan y Galletas'];

    select.innerHTML = '<option value="">Todas las categorías</option>';

    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });

    select.value = currentVal;
}

function aplicarFiltros() {
    const termino = document.getElementById('buscar-producto').value.toLowerCase().trim();
    const catFiltro = document.getElementById('filtro-categoria').value;
    const estFiltro = document.getElementById('filtro-estado').value;

    const filtrados = todosProductos.filter(p => {
        const matchSearch = !termino ||
            (p.codigo && p.codigo.toLowerCase().includes(termino)) ||
            (p.nombre && p.nombre.toLowerCase().includes(termino));

        const matchCat = !catFiltro || p.categoria === catFiltro;

        let matchEst = true;
        const stockBodega = parseInt(p.stock_bodega) || 0;
        const stockTienda = parseInt(p.stock_tienda) || 0;
        const stock = stockBodega + stockTienda;
        const min = parseInt(p.stock_minimo) || 5;

        if (estFiltro === 'disponible') {
            matchEst = stock > min;
        } else if (estFiltro === 'bajo') {
            matchEst = stock > 0 && stock <= min;
        } else if (estFiltro === 'agotado') {
            matchEst = stock <= 0;
        }

        return matchSearch && matchCat && matchEst;
    });

    productosVisibles = filtrados;
    renderTablaActual(filtrados);

    const btnRegresar = document.getElementById('btn-regresar-busqueda');
    if (btnRegresar) {
        btnRegresar.style.display = termino ? 'inline-flex' : 'none';
    }
}

function regresarBusqueda() {
    const input = document.getElementById('buscar-producto');
    const btnRegresar = document.getElementById('btn-regresar-busqueda');
    if (input) input.value = '';
    if (btnRegresar) btnRegresar.style.display = 'none';
    aplicarFiltros();
}

function switchTab(tab) {
    currentTab = tab;

    const tabBodega = document.getElementById('tab-bodega');
    const tabTienda = document.getElementById('tab-tienda');
    const panelBodega = document.getElementById('panel-bodega');
    const panelTienda = document.getElementById('panel-tienda');

    if (tab === 'bodega') {
        if (tabBodega) tabBodega.classList.add('active');
        if (tabTienda) tabTienda.classList.remove('active');
        if (panelBodega) panelBodega.style.display = 'block';
        if (panelTienda) panelTienda.style.display = 'none';
    } else {
        if (tabTienda) tabTienda.classList.add('active');
        if (tabBodega) tabBodega.classList.remove('active');
        if (panelTienda) panelTienda.style.display = 'block';
        if (panelBodega) panelBodega.style.display = 'none';
    }

    renderTablaActual(productosVisibles);
}
window.switchTab = switchTab;

function renderTablaActual(lista) {
    if (currentTab === 'bodega') {
        renderBodegaTable(lista);
    } else {
        renderTiendaTable(lista);
    }
}

function renderBodegaTable(lista) {
    const tbody = document.getElementById('bodega-body');
    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No se encontraron productos en bodega con los criterios seleccionados.
                </td>
            </tr>`;
        return;
    }

    lista.forEach(producto => {
        const row = document.createElement('tr');
        const stockBodega = parseInt(producto.stock_bodega) || 0;
        const minStock = parseInt(producto.stock_minimo) || 5;

        let estadoHtml = '<span class="badge badge-success">✅ En Bodega</span>';
        if (stockBodega <= 0) {
            estadoHtml = '<span class="badge badge-danger">🚫 Vacío</span>';
        } else if (stockBodega <= minStock) {
            estadoHtml = '<span class="badge badge-warning">⚠️ Stock Bajo</span>';
        }

        row.innerHTML = `
            <td><code>${producto.codigo}</code></td>
            <td><strong>${producto.nombre}</strong></td>
            <td><span class="category-tag">${producto.categoria || 'General'}</span></td>
            <td><strong>${stockBodega}</strong></td>
            <td>${estadoHtml}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="abrirModalEditarProducto(${producto.id})" title="Editar">
                    ✏️
                </button>
                <button class="btn btn-sm btn-success" onclick="abrirModalAgregarStock(${producto.id}, ${stockBodega})">
                    ➕ Agregar
                </button>
                ${stockBodega > 0 ? `<button class="btn btn-sm btn-primary" onclick="abrirModalTraspaso(${producto.id}, ${stockBodega}, '${producto.nombre.replace(/'/g, "\\'")}')">🚚 Mover</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="confirmarEliminarProducto(${producto.id}, '${producto.nombre.replace(/'/g, "\\'")}')">
                    🗑️ Eliminar
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderTiendaTable(lista) {
    const tbody = document.getElementById('tienda-body');
    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    No se encontraron productos en tienda con los criterios seleccionados.
                </td>
            </tr>`;
        return;
    }

    lista.forEach(producto => {
        const row = document.createElement('tr');
        const stockTienda = parseInt(producto.stock_tienda) || 0;
        const minStock = parseInt(producto.stock_minimo) || 5;
        const precio = parseFloat(producto.precio) || parseFloat(producto.precio_venta) || 0;

        let estadoHtml = '<span class="badge badge-success">✅ En Tienda</span>';
        if (stockTienda <= 0) {
            estadoHtml = '<span class="badge badge-danger">🚫 Agotado</span>';
        } else if (stockTienda <= minStock) {
            estadoHtml = '<span class="badge badge-warning">⚠️ Stock Bajo</span>';
        }

        row.innerHTML = `
            <td><code>${producto.codigo}</code></td>
            <td><strong>${producto.nombre}</strong></td>
            <td><span class="category-tag">${producto.categoria || 'General'}</span></td>
            <td><strong>${formatCurrency(precio)}</strong></td>
            <td><span class="stock-num ${stockTienda <= minStock ? 'text-danger' : ''}">${stockTienda}</span></td>
            <td>${estadoHtml}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="abrirModalEditarProducto(${producto.id})" title="Editar">
                    ✏️
                </button>
                <button class="btn btn-sm btn-danger" onclick="confirmarEliminarProducto(${producto.id}, '${producto.nombre.replace(/'/g, "\\'")}')">
                    🗑️ Eliminar
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function confirmarEliminarProducto(id, nombre) {
    if (confirm(`¿Estás seguro de que deseas eliminar el producto "${nombre}"? Esta acción no se puede deshacer.`)) {
        try {
            const res = await apiFetch(`/api/inventario/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast('Producto Eliminado', `El producto "${nombre}" fue eliminado correctamente.`, 'success');
                loadProductos();
                if (typeof window.actualizarMétricasDashboard === 'function') {
                    window.actualizarMétricasDashboard();
                }
            } else {
                showToast('Error al Eliminar', data.error || 'No se pudo eliminar el producto', 'error');
            }
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            showToast('Error de Conexión', 'No se pudo conectar con el servidor para eliminar el producto', 'error');
        }
    }
}

// =====================================
// EDITAR PRODUCTO
// =====================================

async function abrirModalEditarProducto(productoId) {
    try {
        const response = await apiFetch(`/api/inventario/${productoId}`);
        if (!response.ok) {
            showToast('Error', 'No se pudo cargar el producto', 'error');
            return;
        }
        const producto = await response.json();

        document.getElementById('edit-producto-id').value = producto.id;
        document.getElementById('edit-nombre').value = producto.nombre || '';
        document.getElementById('edit-codigo').value = producto.codigo || '';
        document.getElementById('edit-categoria').value = producto.categoria || '';
        document.getElementById('edit-proveedor').value = producto.proveedor || '';
        document.getElementById('edit-precio-publico').value = producto.precio_publico || producto.precio || '';
        document.getElementById('edit-precio-cvs').value = producto.precio_cvs || '';
        document.getElementById('edit-precio').value = producto.precio || '';
        document.getElementById('edit-stock-minimo').value = producto.stock_minimo || 5;
        document.getElementById('edit-stock').value = (parseInt(producto.stock_bodega) || 0) + (parseInt(producto.stock_tienda) || 0);

        const modal = document.getElementById('modal-editar-producto');
        if (modal) {
            modal.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error al cargar producto para editar:', error);
        showToast('Error', 'No se pudo cargar el producto', 'error');
    }
}

function cerrarModalEditarProducto() {
    const modal = document.getElementById('modal-editar-producto');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function guardarEdicionProducto() {
    const id = document.getElementById('edit-producto-id').value;
    const nombre = document.getElementById('edit-nombre').value.trim();
    const codigo = document.getElementById('edit-codigo').value.trim();

    if (!nombre || !codigo) {
        showToast('Campos Requeridos', 'Nombre y Código de Barras son obligatorios', 'warning');
        return;
    }

    const payload = {
        nombre,
        codigo,
        categoria: document.getElementById('edit-categoria').value.trim(),
        proveedor: document.getElementById('edit-proveedor').value.trim(),
        precio_publico: parseFloat(document.getElementById('edit-precio-publico').value) || 0,
        precio_cvs: parseFloat(document.getElementById('edit-precio-cvs').value) || 0,
        precio: parseFloat(document.getElementById('edit-precio').value) || 0,
        stock_minimo: parseInt(document.getElementById('edit-stock-minimo').value) || 5,
        stock_bodega: parseInt(document.getElementById('edit-stock').value) || 0
    };

    try {
        const response = await apiFetch(`/api/inventario/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Producto Actualizado', `Producto "${nombre}" actualizado correctamente`, 'success');
            cerrarModalEditarProducto();
            loadProductos();
        } else {
            showToast('Error', data.error || 'No se pudo actualizar el producto', 'error');
        }
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        showToast('Error de Conexión', 'No se pudo conectar con el servidor', 'error');
    }
}

let traspasoProductoId = null;
let traspasoStockDisponible = 0;

function abrirModalTraspaso(productoId, stockBodega, nombre) {
    traspasoProductoId = productoId;
    traspasoStockDisponible = stockBodega;

    const cantidadInput = document.getElementById('traspaso-cantidad');
    const disponibleText = document.getElementById('traspaso-disponible');
    const nombreText = document.getElementById('traspaso-producto-nombre');

    if (nombreText) {
        nombreText.innerHTML = `<strong>Producto:</strong> ${nombre}`;
    }

    if (cantidadInput) {
        cantidadInput.value = 1;
        cantidadInput.max = stockBodega;
        cantidadInput.min = 1;
    }

    if (disponibleText) {
        disponibleText.textContent = `Stock disponible en bodega: ${stockBodega} unidades`;
    }

    const modal = document.getElementById('modal-traspaso');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModalTraspaso() {
    const modal = document.getElementById('modal-traspaso');
    if (modal) {
        modal.style.display = 'none';
    }
    traspasoProductoId = null;
    traspasoStockDisponible = 0;
}

async function ejecutarTraspaso() {
    if (!traspasoProductoId) return;

    const cantidadInput = document.getElementById('traspaso-cantidad');
    const cantidad = parseInt(cantidadInput?.value) || 0;

    if (cantidad <= 0 || cantidad > traspasoStockDisponible) {
        showToast('Cantidad Inválida', `Debe ser entre 1 y ${traspasoStockDisponible}`, 'error');
        return;
    }

    try {
        const res = await apiFetch('/api/inventario/traspaso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ producto_id: traspasoProductoId, cantidad })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Traspaso Exitoso', `${cantidad} unidades movidas de Bodega a Tienda`, 'success');
            cerrarModalTraspaso();
            loadProductos();
            if (typeof window.actualizarMétricasDashboard === 'function') {
                window.actualizarMétricasDashboard();
            }
        } else {
            showToast('Error en Traspaso', data.error || 'No se pudo realizar el traspaso', 'error');
        }
    } catch (error) {
        console.error('Error al ejecutar traspaso:', error);
        showToast('Error de Conexión', 'No se pudo conectar con el servidor', 'error');
    }
}

function abrirModalAgregarStock(productoId, stockActual) {
    agregarStockProductoId = productoId;

    const cantidadInput = document.getElementById('agregar-cantidad');
    const stockActualText = document.getElementById('agregar-stock-actual');
    const nombreText = document.getElementById('agregar-producto-nombre');

    if (stockActualText) {
        stockActualText.textContent = stockActual;
    }

    if (cantidadInput) {
        cantidadInput.value = 1;
        cantidadInput.min = 1;
    }

    const producto = todosProductos.find(p => p.id === productoId);
    if (nombreText && producto) {
        nombreText.innerHTML = `<strong>Producto:</strong> ${producto.nombre}`;
    }

    const modal = document.getElementById('modal-agregar-stock');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModalAgregarStock() {
    const modal = document.getElementById('modal-agregar-stock');
    if (modal) {
        modal.style.display = 'none';
    }
    agregarStockProductoId = null;
}

async function ejecutarAgregarStock() {
    if (!agregarStockProductoId) return;

    const cantidadInput = document.getElementById('agregar-cantidad');
    const cantidad = parseInt(cantidadInput?.value) || 0;

    if (cantidad <= 0) {
        showToast('Cantidad Inválida', 'Debe ingresar una cantidad mayor a 0', 'error');
        return;
    }

    try {
        const res = await apiFetch('/api/inventario/agregar-stock-bodega', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ producto_id: agregarStockProductoId, cantidad })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Stock Actualizado', `${cantidad} unidades agregadas a Bodega`, 'success');
            cerrarModalAgregarStock();
            loadProductos();
            if (typeof window.actualizarMétricasDashboard === 'function') {
                window.actualizarMétricasDashboard();
            }
        } else {
            showToast('Error', data.error || 'No se pudo agregar stock', 'error');
        }
    } catch (error) {
        console.error('Error al agregar stock:', error);
        showToast('Error de Conexión', 'No se pudo conectar con el servidor', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('inventario');
    loadProductos();

    const btnTraspaso = document.getElementById('btn-confirmar-traspaso');
    if (btnTraspaso) {
        btnTraspaso.addEventListener('click', ejecutarTraspaso);
    }

    const btnAgregarStock = document.getElementById('btn-confirmar-agregar-stock');
    if (btnAgregarStock) {
        btnAgregarStock.addEventListener('click', ejecutarAgregarStock);
    }

    document.getElementById('buscar-producto').addEventListener('input', aplicarFiltros);
    document.getElementById('filtro-categoria').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-estado').addEventListener('change', aplicarFiltros);
});

function imprimirInventario() {
    const panelBodega = document.getElementById('panel-bodega');
    const esBodegaVisible = panelBodega && panelBodega.style.display !== 'none';

    const titulo = esBodegaVisible ? 'Reporte de Inventario - BODEGA' : 'Reporte de Inventario - TIENDA';
    const productos = productosVisibles.length > 0 ? productosVisibles : todosProductos;

    let filasHTML = '';
    if (productos.length > 0) {
        productos.forEach((p, idx) => {
            const stockBodega = parseInt(p.stock_bodega) || 0;
            const stockTienda = parseInt(p.stock_tienda) || 0;
            const minStock = parseInt(p.stock_minimo) || 5;

            let estado = '✅ En Stock';
            if (esBodegaVisible) {
                if (stockBodega <= 0) estado = '🚫 Vacío';
                else if (stockBodega <= minStock) estado = '⚠️ Stock Bajo';
            } else {
                if (stockTienda <= 0) estado = '🚫 Agotado';
                else if (stockTienda <= minStock) estado = '⚠️ Stock Bajo';
            }

            if (esBodegaVisible) {
                filasHTML += `<tr>
                    <td>${p.codigo || 'S/C'}</td>
                    <td>${p.nombre}</td>
                    <td>${p.categoria || 'General'}</td>
                    <td>${stockBodega}</td>
                    <td>${estado}</td>
                </tr>`;
            } else {
                const precio = parseFloat(p.precio) || parseFloat(p.precio_venta) || 0;
                filasHTML += `<tr>
                    <td>${p.codigo || 'S/C'}</td>
                    <td>${p.nombre}</td>
                    <td>${p.categoria || 'General'}</td>
                    <td>${formatCurrency(precio)}</td>
                    <td>${stockTienda}</td>
                    <td>${estado}</td>
                </tr>`;
            }
        });
    } else {
        const colSpan = esBodegaVisible ? 5 : 6;
        filasHTML = `<tr><td colspan="${colSpan}" style="text-align:center;">No hay productos registrados en esta sección</td></tr>`;
    }

    const encabezados = esBodegaVisible
        ? '<th>Código</th><th>Producto</th><th>Categoría</th><th>Stock Bodega</th><th>Estado</th>'
        : '<th>Código</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock Tienda</th><th>Estado</th>';

    const ventana = window.open('', '', 'height=700,width=900');
    ventana.document.write(`
        <html>
            <head>
                <title>${titulo}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h2 { text-align: center; margin-bottom: 5px; }
                    .fecha { text-align: center; font-size: 13px; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; font-size: 12px; }
                    th { background-color: #f4f4f4; font-weight: bold; }
                    tr:nth-child(even) { background-color: #fafafa; }
                </style>
            </head>
            <body>
                <h2>${titulo}</h2>
                <div class="fecha">Fecha de emisión: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour12: true })}</div>
                <table>
                    <thead><tr>${encabezados}</tr></thead>
                    <tbody>${filasHTML}</tbody>
                </table>
            </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
        ventana.print();
        ventana.close();
    }, 300);
}

window.imprimirInventario = imprimirInventario;

async function imprimirInventarioGeneral() {
    try {
        const res = await apiFetch('/api/inventario');
        const data = await res.json();
        const productos = window.ensureArray(data, 'productos');

        if (!productos || productos.length === 0) {
            alert('No hay productos para generar el reporte');
            return;
        }

        let totalUnidades = 0;
        let valorInversion = 0;

        let filasHTML = productos.map((prod, index) => {
            const stockBodega = Number(prod.stock_bodega || 0);
            const stockTienda = Number(prod.stock_tienda || 0);
            const stockTotal = stockBodega + stockTienda;

            const pCompra = Number(prod.precio_compra || prod.precio || 0);
            const pVenta = Number(prod.precio || 0);

            totalUnidades += stockTotal;
            valorInversion += (pCompra * stockTotal);

            return `
                <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td>${prod.codigo || ''}</td>
                    <td><strong>${prod.nombre || ''}</strong></td>
                    <td>${prod.categoria || ''}</td>
                    <td style="text-align:right;">$${pCompra.toFixed(2)}</td>
                    <td style="text-align:right;">$${pVenta.toFixed(2)}</td>
                    <td style="text-align:center; font-weight:bold;">${stockTotal}</td>
                </tr>
            `;
        }).join('');

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

        const ventana = window.open('', '', 'height=800,width=950');
        ventana.document.write(`
            <html>
                <head>
                    <title>CENTRO DE VIDA SANA - REPORTE GENERAL DE INVENTARIO</title>
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
                        .footer-summary { margin-top: 20px; padding: 12px; background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 4px; display: flex; justify-content: space-around; font-weight: bold; color: #2b6cb0; font-size: 13px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>CENTRO DE VIDA SANA</h1>
                        <h2>REPORTE GENERAL DE INVENTARIO Y STOCK</h2>
                    </div>
                    <div class="meta">
                        <span><strong>Fecha de Generación:</strong> ${fechaEmision}</span>
                        <span><strong>Total de Registros:</strong> ${productos.length} productos</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:4%;">#</th>
                                <th style="width:16%;">CÓDIGO</th>
                                <th style="width:30%;">PRODUCTO</th>
                                <th style="width:16%;">CATEGORÍA</th>
                                <th style="width:12%;">P. COMPRA</th>
                                <th style="width:12%;">P. VENTA</th>
                                <th style="width:10%;">STOCK</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHTML}
                        </tbody>
                    </table>
                    <div class="footer-summary">
                        <span>Variedad de Productos: ${productos.length}</span>
                        <span>Unidades Totales en Stock: ${totalUnidades}</span>
                        <span>Valor Estimado de Inversión: $${valorInversion.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
        console.error('Error al generar el reporte general:', error);
        alert('Error al obtener los datos para el reporte general');
    }
}

window.imprimirInventarioGeneral = imprimirInventarioGeneral;