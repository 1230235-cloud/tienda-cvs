// Módulo de Inventario (Consulta de productos en tienda)

let todosProductos = [];

async function loadProductos() {
    try {
        const response = await fetch('/api/inventario');
        if (!response.ok) return;
        todosProductos = await response.json();

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
        const stock = parseInt(p.stock) || 0;
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
    const categorias = [...new Set(todosProductos.map(p => p.categoria).filter(Boolean))].sort();
    
    // Guardar selección previa
    const currentVal = select.value;
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
        const stock = parseInt(p.stock) || 0;
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

    renderProductosTable(filtrados);

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

function renderProductosTable(lista) {
    const tbody = document.getElementById('productos-body');
    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    No se encontraron productos en el inventario con los criterios seleccionados.
                </td>
            </tr>`;
        return;
    }

    lista.forEach(producto => {
        const row = document.createElement('tr');
        const stock = parseInt(producto.stock) || 0;
        const minStock = parseInt(producto.stock_minimo) || 5;
        const precio = parseFloat(producto.precio) || parseFloat(producto.precio_venta) || 0;

        let badgeHtml = '<span class="badge badge-success">✅ En Stock</span>';
        if (stock <= 0) {
            badgeHtml = '<span class="badge badge-danger">🚫 Agotado</span>';
        } else if (stock <= minStock) {
            badgeHtml = '<span class="badge badge-warning">⚠️ Stock Bajo</span>';
        }

        row.innerHTML = `
            <td><code>${producto.codigo}</code></td>
            <td><strong>${producto.nombre}</strong></td>
            <td><span class="category-tag">${producto.categoria || 'General'}</span></td>
            <td><strong>${formatCurrency(precio)}</strong></td>
            <td><span class="stock-num ${stock <= minStock ? 'text-danger' : ''}">${stock}</span></td>
            <td>${minStock}</td>
            <td>${badgeHtml}</td>
            <td>
                <a href="entradas.html?buscar=${encodeURIComponent(producto.codigo)}" class="btn btn-sm btn-outline">
                    📥 Surtir
                </a>
            </td>
        `;
        tbody.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('inventario');
    loadProductos();

    document.getElementById('buscar-producto').addEventListener('input', aplicarFiltros);
    document.getElementById('filtro-categoria').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-estado').addEventListener('change', aplicarFiltros);
});
