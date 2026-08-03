// Módulo de Códigos de Barras

let todosProductos = [];
let categorias = [];

async function loadProductos() {
    try {
        const response = await fetch('/api/inventario');
        if (!response.ok) return;
        todosProductos = await response.json();
        populateCategorias();
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function populateCategorias() {
    const select = document.getElementById('barcode-categoria');
    categorias = [...new Set(todosProductos.map(p => p.categoria).filter(Boolean))].sort();

    select.innerHTML = '<option value="">Selecciona una categoría</option>';

    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

function getCategoryPrefix(categoria) {
    const cat = (categoria || '').toLowerCase().trim();
    const map = {
        'bebidas': '750',
        'botanas': '751',
        'lácteos': '752',
        'abarrotes': '753',
        'galletas': '754',
        'dulces': '755',
        'limpieza': '756',
        'hogar': '757',
        'enlatados': '758',
        'general': '759'
    };
    return map[cat] || '759';
}

function generateBarcodeForProduct(producto, index) {
    const prefix = getCategoryPrefix(producto.categoria);
    const num = String(index).padStart(4, '0');
    return `${prefix}${num}`;
}

function generarCodigosBarras() {
    const categoria = document.getElementById('barcode-categoria').value;
    const cantidad = parseInt(document.getElementById('barcode-cantidad').value) || 1;

    if (!categoria) {
        showToast('Selecciona una categoría', 'Debes seleccionar un tipo de producto', 'warning');
        return;
    }

    const productosFiltrados = todosProductos.filter(p => p.categoria === categoria);

    if (productosFiltrados.length === 0) {
        showToast('Sin productos', 'No hay productos en esta categoría', 'warning');
        return;
    }

    const previewGrid = document.getElementById('barcode-preview-grid');
    const printGrid = document.getElementById('barcode-print-grid');
    previewGrid.innerHTML = '';
    printGrid.innerHTML = '';

    const allCodes = [];

    productosFiltrados.forEach((producto, idx) => {
        const code = generateBarcodeForProduct(producto, idx + 1);

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
    window.print();
    printArea.classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('codigos-barras');
    loadProductos();

    document.getElementById('barcode-categoria').addEventListener('change', () => {
        document.getElementById('barcode-preview-area').style.display = 'none';
    });
});
