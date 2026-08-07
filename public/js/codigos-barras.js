// Módulo de Códigos de Barras

let todosProductos = [];

async function loadProductos() {
    try {
        const response = await apiFetch('/api/inventario');
        if (!response.ok) return;
        const data = await response.json();
        todosProductos = window.ensureArray(data, 'productos');
        populateProductos();
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function populateProductos() {
    const select = document.getElementById('barcode-producto');
    select.innerHTML = '<option value="">Todos los productos</option>';

    todosProductos.forEach(prod => {
        const opt = document.createElement('option');
        opt.value = prod.id;
        opt.textContent = `${prod.codigo} - ${prod.nombre}`;
        select.appendChild(opt);
    });
}

function generarCodigosBarras() {
    const productoId = document.getElementById('barcode-producto').value;
    const cantidad = parseInt(document.getElementById('barcode-cantidad').value) || 1;

    const previewGrid = document.getElementById('barcode-preview-grid');
    const printGrid = document.getElementById('barcode-print-grid');
    previewGrid.innerHTML = '';
    printGrid.innerHTML = '';

    let productosFiltrados = [];
    if (productoId) {
        const prod = todosProductos.find(p => p.id === parseInt(productoId));
        if (prod) {
            productosFiltrados = [prod];
        }
    } else {
        productosFiltrados = todosProductos;
    }

    if (productosFiltrados.length === 0) {
        showToast('Sin productos', 'No hay productos disponibles', 'warning');
        return;
    }

    const allCodes = [];

    productosFiltrados.forEach((producto, idx) => {
        const code = producto.codigo || `759${String(idx + 1).padStart(4, '0')}`;

        for (let i = 0; i < cantidad; i++) {
            allCodes.push({
                code,
                nombre: producto.nombre,
                precio: producto.precio,
                producto
            });
        }
    });

    allCodes.forEach(item => {
        const previewCard = document.createElement('div');
        previewCard.className = 'barcode-card';
        const svgId = `preview-barcode-${item.code}-${Math.random().toString(36).slice(2, 8)}`;
        previewCard.innerHTML = `
            <svg id="${svgId}"></svg>
            <div class="barcode-product-name">${item.nombre}</div>
            <div class="barcode-product-code">${item.code}</div>
            <div class="barcode-product-price">${formatCurrency(item.precio)}</div>
        `;
        previewGrid.appendChild(previewCard);

        const printCard = document.createElement('div');
        printCard.className = 'barcode-card';
        const printSvgId = `print-barcode-${item.code}-${Math.random().toString(36).slice(2, 8)}`;
        printCard.innerHTML = `
            <svg id="${printSvgId}"></svg>
            <div class="barcode-product-name">${item.nombre}</div>
            <div class="barcode-product-code">${item.code}</div>
            <div class="barcode-product-price">${formatCurrency(item.precio)}</div>
        `;
        printGrid.appendChild(printCard);

        try {
            JsBarcode(`#${svgId}`, item.code, {
                format: 'CODE128',
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 5
            });

            JsBarcode(`#${printSvgId}`, item.code, {
                format: 'CODE128',
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 5
            });
        } catch (e) {
            console.error('Error generando código de barras:', e);
        }
    });

    document.getElementById('barcode-preview-area').style.display = 'block';
    showToast('Códigos generados', `${allCodes.length} etiquetas listas para imprimir`, 'success');
}

function imprimirCodigosBarras() {
    const printArea = document.getElementById('barcode-print-area');
    if (!printArea || !printArea.innerHTML.trim()) {
        showToast('Sin contenido', 'Genera los códigos de barras antes de imprimir', 'warning');
        return;
    }

    printArea.classList.add('visible');
    
    setTimeout(() => {
        window.print();
        printArea.classList.remove('visible');
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('codigos-barras');
    loadProductos();

    document.getElementById('barcode-producto').addEventListener('change', () => {
        document.getElementById('barcode-preview-area').style.display = 'none';
    });
});
