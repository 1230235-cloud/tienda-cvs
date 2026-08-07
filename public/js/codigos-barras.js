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
        const canvasId = `preview-barcode-${item.code}-${Math.random().toString(36).slice(2, 8)}`;
        previewCard.innerHTML = `
            <canvas id="${canvasId}"></canvas>
            <div class="barcode-product-name">${item.nombre}</div>
            <div class="barcode-product-code">${item.code}</div>
            <div class="barcode-product-price">${formatCurrency(item.precio)}</div>
        `;
        previewGrid.appendChild(previewCard);

        const printCard = document.createElement('div');
        printCard.className = 'barcode-card';
        const printCanvasId = `print-barcode-${item.code}-${Math.random().toString(36).slice(2, 8)}`;
        printCard.innerHTML = `
            <canvas id="${printCanvasId}"></canvas>
            <div class="barcode-product-name">${item.nombre}</div>
            <div class="barcode-product-code">${item.code}</div>
            <div class="barcode-product-price">${formatCurrency(item.precio)}</div>
        `;
        printGrid.appendChild(printCard);

        try {
            JsBarcode(`#${canvasId}`, item.code, {
                format: 'CODE128',
                width: 0.75,
                height: 20,
                displayValue: true,
                fontSize: 5,
                margin: 2
            });

            JsBarcode(`#${printCanvasId}`, item.code, {
                format: 'CODE128',
                width: 0.75,
                height: 20,
                displayValue: true,
                fontSize: 5,
                margin: 2
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

    const cards = printArea.querySelectorAll('.barcode-card');
    if (cards.length === 0) {
        showToast('Sin contenido', 'Genera los códigos de barras antes de imprimir', 'warning');
        return;
    }

    let itemsHTML = '';
    cards.forEach(card => {
        const canvas = card.querySelector('canvas');
        const nombre = card.querySelector('.barcode-product-name')?.textContent || '';
        const codigo = card.querySelector('.barcode-product-code')?.textContent || '';
        const precio = card.querySelector('.barcode-product-price')?.textContent || '';
        
        if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            itemsHTML += `
                <div class="print-barcode-item">
                    <img src="${imgData}" alt="${codigo}" />
                    <div class="print-barcode-name">${nombre}</div>
                    <div class="print-barcode-code">${codigo}</div>
                    <div class="print-barcode-price">${precio}</div>
                </div>
            `;
        }
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        alert('No se pudo abrir la ventana de impresión. Verifica que no esté bloqueada por el navegador.');
        return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Códigos de Barras - Tienda CVS</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 5mm;
        }
        @media print {
            body {
                margin: 0 !important;
                padding: 0 !important;
            }
            .no-print {
                display: none !important;
            }
        }
        body {
            font-family: 'Courier New', Courier, monospace;
            margin: 10px;
            padding: 10px;
        }
        .print-header {
            text-align: center;
            margin-bottom: 15px;
            font-size: 12pt;
        }
        .print-header h1 {
            margin: 0;
            font-size: 14pt;
        }
        .print-barcode-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: center;
        }
        .print-barcode-item {
            width: 100px;
            text-align: center;
            border: 1px solid #ccc;
            padding: 4px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .print-barcode-item img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
        }
        .print-barcode-name {
            font-weight: bold;
            font-size: 6pt;
            margin-top: 2px;
            word-wrap: break-word;
        }
        .print-barcode-code {
            font-family: monospace;
            font-size: 5pt;
            color: #555;
            margin-top: 1px;
        }
        .print-barcode-price {
            font-weight: bold;
            font-size: 6pt;
            margin-top: 1px;
            color: #000;
        }
        .print-actions {
            text-align: center;
            margin-top: 20px;
            padding: 10px;
            background: #f5f5f5;
            border-top: 1px solid #ddd;
        }
        .print-actions button {
            padding: 10px 20px;
            font-size: 14px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>CENTRO DE VIDA SANA</h1>
        <p>Códigos de Barras - ${new Date().toLocaleDateString('es-MX')}</p>
    </div>
    <div class="print-barcode-grid">
        ${itemsHTML}
    </div>
    <div class="print-actions no-print">
        <button onclick="window.print(); window.close();">🖨️ Imprimir</button>
        <button onclick="window.close();">Cerrar</button>
    </div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('codigos-barras');
    loadProductos();

    document.getElementById('barcode-producto').addEventListener('change', () => {
        document.getElementById('barcode-preview-area').style.display = 'none';
    });
});
