// Página Principal - Tienda CVS

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    renderGlobalHeader('index');

    const imageContainer = document.getElementById('landing-image-container');
    
    const savedImage = localStorage.getItem('landing_image');
    if (savedImage) {
        imageContainer.innerHTML = `<img src="${savedImage}" alt="Imagen principal" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
    }
});

function uploadLandingImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const imageContainer = document.getElementById('landing-image-container');
            imageContainer.innerHTML = `<img src="${event.target.result}" alt="Imagen principal">`;
            localStorage.setItem('landing_image', event.target.result);
            showToast('Imagen actualizada', 'La imagen principal se ha cargado correctamente', 'success');
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
}

function clearLandingImage() {
    const imageContainer = document.getElementById('landing-image-container');
    imageContainer.innerHTML = `
        <div class="landing-image-placeholder">
            <span class="placeholder-icon">🖼️</span>
            <span>Imagen principal próximamente</span>
        </div>
    `;
    localStorage.removeItem('landing_image');
    showToast('Imagen eliminada', 'Se ha restaurado el placeholder', 'info');
}
