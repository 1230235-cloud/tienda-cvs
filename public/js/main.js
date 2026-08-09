// =====================================
// TIENDA CVS - FUNCIONES GLOBALES
// =====================================

window.API_BASE_URL = (() => {
    const SERVER_HOST = window.location.hostname || '100.91.160.121';
    return `http://${SERVER_HOST}:3000`;
  })();

async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${window.API_BASE_URL}${url}`;
  const token = localStorage.getItem('auth_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(fullUrl, { ...options, headers });
  return response;
}

window.ensureArray = function(data, key) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (key && Array.isArray(data[key])) return data[key];
    const arrayProp = Object.values(data).find(val => Array.isArray(val));
    if (arrayProp) return arrayProp;
  }
  return [];
};

// =====================================
// CONTROL DE ACCESO POR ROLES
// =====================================

const usuarioSesion = JSON.parse(localStorage.getItem('usuario') || '{}');
const esCajero = usuarioSesion.rol && usuarioSesion.rol.toUpperCase() === 'CAJERO';
const esAdmin = usuarioSesion.rol && usuarioSesion.rol.toUpperCase() === 'ADMIN';

function aplicarPermisosUI() {
  if (!esCajero && !esAdmin) return;

  const paginasPermitidasCajero = ['ventas.html', 'codigos-barras.html', 'corte-caja.html', 'cortes.html', 'index.html', 'login.html'];
  const paginaActual = window.location.pathname.split('/').pop().toLowerCase();

  if (esCajero && paginaActual && !paginasPermitidasCajero.some(pag => paginaActual.includes(pag))) {
    alert('Acceso restringido: Tu perfil de Cajero no tiene permisos para ingresar a esta sección.');
    window.location.href = 'ventas.html';
    return;
  }

  document.querySelectorAll('.sidebar-link, .sidebar-nav-item, .nav-item').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (esCajero && href && !paginasPermitidasCajero.some(pag => href.includes(pag))) {
      link.style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  aplicarPermisosUI();
});

// Formatear moneda a MXN
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount || 0);
}

// Formatear fecha (UTC - para almacenamiento)
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Formatear fecha en zona horaria local de México
function formatearFechaLocal(dateString) {
    if (!dateString) return '';
    const fecha = new Date(dateString);
    return fecha.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Verificar autenticación
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Cargar información del usuario
function loadUserInfo() {
    try {
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        return userInfo;
    } catch(e) {
        return {};
    }
}

// Mostrar notificación temporal
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-' + type;
    alertDiv.textContent = message;
    
    const container = document.querySelector('.main-content');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, 4000);
    }
}

// Sistema de notificaciones toast personalizadas
function showToast(title, message = '', type = 'info') {
    let container = document.querySelector('.notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `notification ${type}`;
    
    const icons = {
        success: '✅',
        warning: '⚠️',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            ${message ? `<div class="notification-message">${message}</div>` : ''}
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Reemplazar alert() nativo por toast
window.alert = function(message) {
    showToast('Aviso', message, 'info');
};

// Cerrar sesión con confirmación personalizada
function logout() {
    const content = `
        <p style="font-size: 1em; color: var(--gray-700);">¿Estás seguro de que deseas <strong>cerrar sesión</strong>?</p>
    `;
    const footer = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary btn-lg" id="btn-confirm-logout">🚪 Cerrar Sesión</button>
    `;
    createModal('Cerrar Sesión', content, footer);

    const btnConfirm = document.getElementById('btn-confirm-logout');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            closeModal();
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            localStorage.removeItem('usuario');
            showToast('Sesión cerrada', 'Has cerrado sesión correctamente', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        });
    }
}

async function apiCall(url, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await apiFetch(url, options);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error en la solicitud');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error API:', error);
        showNotification(error.message || 'Error al conectar con el servidor', 'danger');
        throw error;
    }
}

// =====================================
// FUNCIONES DEL SIDEBAR
// =====================================

function initSidebar() {
    if (document.getElementById('sidebar')) return;

    const user = loadUserInfo();
    const userName = user.nombre || 'Usuario';

    const sidebarHTML = `
        <aside class="sidebar collapsed" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-brand">
                    <img src="assets/logo-vida-sana.png" alt="Logo Vida Sana" class="sidebar-logo-img">
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <a href="dashboard.html" class="sidebar-nav-item" data-page="dashboard">
                    <i class="fa-solid fa-chart-line sidebar-nav-icon"></i>
                    <span>Dashboard</span>
                </a>
                <a href="inventario.html" class="sidebar-nav-item" data-page="inventario">
                    <i class="fa-solid fa-boxes-stacked sidebar-nav-icon"></i>
                    <span>Inventario</span>
                </a>
                <a href="proveedores.html" class="sidebar-nav-item" data-page="proveedores">
                    <i class="fa-solid fa-truck sidebar-nav-icon"></i>
                    <span>Proveedores</span>
                </a>
                <a href="entradas.html" class="sidebar-nav-item" data-page="entradas">
                    <i class="fa-solid fa-file-import sidebar-nav-icon"></i>
                    <span>Entradas</span>
                </a>
                <a href="ventas.html" class="sidebar-nav-item" data-page="ventas">
                    <i class="fa-solid fa-cash-register sidebar-nav-icon"></i>
                    <span>Punto de Venta</span>
                </a>
                <a href="codigos-barras.html" class="sidebar-nav-item" data-page="codigos-barras">
                    <i class="fa-solid fa-barcode sidebar-nav-icon"></i>
                    <span>Códigos de Barras</span>
                </a>
                <a href="cortes.html" class="sidebar-nav-item" data-page="cortes">
                    <i class="fa-solid fa-dollar-sign sidebar-nav-icon"></i>
                    <span>Corte de Caja</span>
                </a>
                <a href="ordenes_compra.html" class="sidebar-nav-item" data-page="ordenes_compra">
                    <i class="fa-solid fa-file-lines sidebar-nav-icon"></i>
                    <span>Órdenes de Compra</span>
                </a>
            </nav>

            <div class="sidebar-user-info">
                <span class="sidebar-user-icon">👤</span>
                <span class="sidebar-user-name">${userName}</span>
            </div>
            
            <div class="sidebar-footer">
                <button class="sidebar-footer-btn" id="sidebar-btn-back">
                    <span>←</span>
                    <span>Volver</span>
                </button>
                <button class="sidebar-footer-btn" id="sidebar-btn-logout">
                   
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    
    const sidebar = document.getElementById('sidebar');
    const btnBack = document.getElementById('sidebar-btn-back');
    const btnLogout = document.getElementById('sidebar-btn-logout');
    
    if (btnBack) {
        btnBack.addEventListener('click', (e) => {
            e.preventDefault();
            goBack();
        });
    }
    
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    const navItems = sidebar.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            setSidebarActive(item);
        });
    });

    // Aplicar permisos de rol después de renderizar el sidebar
    aplicarPermisosUI();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('hidden');
        overlay.classList.toggle('active');
    }
}

function setSidebarActive(element) {
    const items = document.querySelectorAll('.sidebar-nav-item');
    items.forEach(item => item.classList.remove('active'));
    if (element) element.classList.add('active');
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = 'index.html';
    }
}

// =====================================
// FUNCIONES DEL MODAL FLOTANTE
// =====================================

function createModal(title, content, footer = '') {
    const modalHTML = `
        <div class="modal-overlay active" id="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div class="modal-body" id="modal-body">
                    ${content}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => modal.remove(), 300);
    }
}

function showCartModal(cartItems, total) {
    let cartHTML = `
        <div class="carrito-info-bar">
            <span class="carrito-items-count">📦 ${cartItems.length} artículos en el carrito</span>
            <span class="carrito-items-count">💰 Total: ${formatCurrency(total)}</span>
        </div>
        <div class="table-responsive">
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    cartItems.forEach(item => {
        const subtotal = item.cantidad * item.precio;
        cartHTML += `
            <tr>
                <td><strong>${item.nombre}</strong></td>
                <td>${item.cantidad}</td>
                <td>${formatCurrency(item.precio)}</td>
                <td>${formatCurrency(subtotal)}</td>
            </tr>
        `;
    });
    
    cartHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    const footer = `
        <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-primary btn-lg" onclick="procesarVenta()">🛍️ Procesar Venta</button>
    `;
    
    createModal('🛒 Carrito de Compra', cartHTML, footer);
}

// Función para generar PDF
function generatePDF(title, data, filename) {
    let html = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #50ff05; border-bottom: 3px solid #50ff05; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #50ff05; color: white; padding: 12px; text-align: left; }
                td { border: 1px solid #ddd; padding: 10px; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .total { font-weight: bold; background-color: #ffe; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <p><strong>Tienda CVS</strong> - Fecha: ${new Date().toLocaleDateString('es-MX')}</p>
            ${data}
            <div class="footer">
                <p>Documento generado por Tienda CVS</p>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}

// Inicializar sidebar cuando la página cargue
document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
});
// Función compatible para renderizar el encabezado/sidebar
function renderGlobalHeader() {
    if (typeof initSidebar === 'function') {
        initSidebar();
    }
    aplicarPermisosUI();
}