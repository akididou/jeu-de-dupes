function openModal(type) {
    document.getElementById('modal' + type.charAt(0).toUpperCase() + type.slice(1)).style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(type) {
    document.getElementById('modal' + type.charAt(0).toUpperCase() + type.slice(1)).style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }
});

function createParfumList(type) {
    const list = document.getElementById(type + 'List');
    list.innerHTML = '';
    parfumsData[type].forEach(parfum => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="parfum-numero">${parfum.numero}</span>
            <span class="parfum-name"><span>Évoque</span> ${parfum.nom}</span>
            <span class="parfum-brand">${parfum.marque}</span>
        `;
        list.appendChild(li);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    createParfumList('homme');
    createParfumList('femme');
});