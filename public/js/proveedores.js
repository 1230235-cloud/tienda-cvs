// Módulo de Gestión de Proveedores

async function loadProveedores() {
    try {
        const res = await apiFetch('/api/proveedores');
        const rawData = await res.json();
        console.log("DATOS RECIBIDOS DEL BACKEND:", rawData);

        let lista = [];
        if (Array.isArray(rawData)) {
            lista = rawData;
        } else if (rawData && typeof rawData === 'object') {
            lista = rawData.proveedores || rawData.data || rawData.rows || rawData.result || [];
        }

        const tbody = document.getElementById('tablaProveedores');
        if (!tbody) {
            console.error("No se encontró el elemento HTML con id='tablaProveedores'");
            return;
        }

        if (!Array.isArray(lista) || lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No hay proveedores registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(p => {
            const id = p.id || p.id_proveedor || p.proveedor_id || '';
            const nombre = p.nombre || p.nombre_proveedor || p.razon_social || 'Sin nombre';
            const contacto = p.contacto || p.nombre_contacto || '-';
            const telefono = p.telefono || p.tel || p.celular || '-';
            const observaciones = p.observaciones || p.notas || p.descripcion || '-';

            return `
                <tr>
                    <td>${id}</td>
                    <td><strong>${nombre}</strong></td>
                    <td>${contacto}</td>
                    <td>${telefono}</td>
                    <td>${observaciones}</td>
                    <td>
                        <button onclick="editarProveedor(${id})" class="btn btn-sm btn-warning me-1">✏️ Editar</button>
                        <button onclick="eliminarProveedor(${id})" class="btn btn-sm btn-danger">🗑️ Eliminar</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al renderizar proveedores:", err);
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

async function guardarProveedor(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('proveedor-id').value;
    const nombre = document.getElementById('proveedor-nombre').value.trim();
    const contacto = document.getElementById('proveedor-contacto').value.trim() || '-';
    const telefono = document.getElementById('proveedor-telefono').value.trim() || '-';
    const observaciones = document.getElementById('proveedor-observaciones').value.trim() || '-';

    if (!nombre) {
        alert("Por favor ingrese el nombre del proveedor");
        return;
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/proveedores/${id}` : `/api/proveedores`;

        const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, contacto, telefono, observaciones })
        });

        if (res.ok || res.status === 200 || res.status === 201) {
            alert("✅ Proveedor guardado correctamente");

            document.getElementById('proveedor-id').value = '';
            document.getElementById('proveedor-nombre').value = '';
            document.getElementById('proveedor-contacto').value = '';
            document.getElementById('proveedor-telefono').value = '';
            document.getElementById('proveedor-observaciones').value = '';

            cerrarModalProveedor();
            await loadProveedores();
        } else {
            const errData = await res.json().catch(() => ({}));
            alert("❌ Error al guardar proveedor: " + (errData.error || "Error en el servidor"));
        }
    } catch (err) {
        console.error("Error guardando proveedor:", err);
        alert("❌ Error de conexión al guardar el proveedor");
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
