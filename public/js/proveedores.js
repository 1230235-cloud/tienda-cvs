// Módulo de Gestión de Proveedores

async function loadProveedores() {
    try {
        const res = await fetch('/api/proveedores');
        const data = await res.json();
        console.log("DATOS RECIBIDOS DEL SERVIDOR:", data);

        const lista = Array.isArray(data) ? data : (data.proveedores || data.data || []);
        const tbody = document.getElementById('tablaProveedores');

        if (!tbody) {
            console.error("No se encontró el elemento #tablaProveedores en el HTML");
            return;
        }

        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">No hay proveedores registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(p => `
            <tr>
                <td>${p.id || ''}</td>
                <td><strong>${p.nombre || ''}</strong></td>
                <td>${p.contacto || '-'}</td>
                <td>${p.telefono || '-'}</td>
                <td>${p.observaciones || '-'}</td>
                <td>
                    <button onclick="editarProveedor(${p.id})" class="btn-sm btn-warning">✏️ Editar</button>
                    <button onclick="eliminarProveedor(${p.id})" class="btn-sm btn-danger">🗑️ Eliminar</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Error al cargar proveedores en tabla:", err);
    }
}

function mostrarModalNuevoProveedor() {
    document.getElementById('proveedor-id').value = '';
    document.getElementById('proveedor-nombre').value = '';
    document.getElementById('proveedor-contacto').value = '';
    document.getElementById('proveedor-telefono').value = '';
    document.getElementById('proveedor-observaciones').value = '';
    document.getElementById('modal-proveedor-titulo').textContent = '➕ Nuevo Proveedor';
    document.getElementById('modal-proveedor').style.display = 'flex';
}

function cerrarModalProveedor() {
    document.getElementById('modal-proveedor').style.display = 'none';
}

async function editarProveedor(id) {
    try {
        const response = await apiFetch(`/api/proveedores/${id}`);
        if (!response.ok) {
            showToast('Error', 'No se pudo cargar el proveedor', 'error');
            return;
        }
        const p = await response.json();

        document.getElementById('proveedor-id').value = p.id;
        document.getElementById('proveedor-nombre').value = p.nombre || '';
        document.getElementById('proveedor-contacto').value = p.contacto || '';
        document.getElementById('proveedor-telefono').value = p.telefono || '';
        document.getElementById('proveedor-observaciones').value = p.observaciones || '';
        document.getElementById('modal-proveedor-titulo').textContent = '✏️ Editar Proveedor';
        document.getElementById('modal-proveedor').style.display = 'flex';
    } catch (error) {
        console.error('Error al cargar proveedor:', error);
        showToast('Error', 'No se pudo cargar el proveedor', 'error');
    }
}

async function guardarProveedor() {
    const id = document.getElementById('proveedor-id').value;
    const nombre = document.getElementById('proveedor-nombre').value.trim();
    const contacto = document.getElementById('proveedor-contacto').value.trim();
    const telefono = document.getElementById('proveedor-telefono').value.trim();
    const observaciones = document.getElementById('proveedor-observaciones').value.trim();

    if (!nombre) {
        showToast('Campo Requerido', 'Ingresa el nombre del proveedor', 'warning');
        return;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/proveedores/${id}` : '/api/proveedores';

        const response = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, contacto, telefono, observaciones })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast('Éxito', data.message || (id ? 'Proveedor actualizado' : 'Proveedor registrado'), 'success');
            document.getElementById('proveedor-id').value = '';
            document.getElementById('proveedor-nombre').value = '';
            document.getElementById('proveedor-contacto').value = '';
            document.getElementById('proveedor-telefono').value = '';
            document.getElementById('proveedor-observaciones').value = '';
            cerrarModalProveedor();
            await loadProveedores();
        } else {
            showToast('Error', data.error || data.message || 'No se pudo guardar el proveedor', 'error');
        }
    } catch (error) {
        console.error('Error al guardar proveedor:', error);
        showToast('Error de Conexión', 'No se pudo guardar el proveedor', 'error');
    }
}

async function eliminarProveedor(id) {
    try {
        const response = await apiFetch(`/api/proveedores/${id}`);
        if (!response.ok) {
            showToast('Error', 'No se pudo cargar el proveedor', 'error');
            return;
        }
        const p = await response.json();
        const nombre = p.nombre || '';

        if (!confirm(`¿Estás seguro de eliminar el proveedor "${nombre}"?`)) {
            return;
        }

        const delRes = await apiFetch(`/api/proveedores/${id}`, { method: 'DELETE' });
        const delData = await delRes.json();

        if (delRes.ok) {
            showToast('Proveedor Eliminado', `Proveedor "${nombre}" eliminado correctamente`, 'success');
            await loadProveedores();
        } else {
            showToast('Error', delData.error || 'No se pudo eliminar el proveedor', 'error');
        }
    } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        showToast('Error de Conexión', 'No se pudo eliminar el proveedor', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('proveedores');
});

loadProveedores();
