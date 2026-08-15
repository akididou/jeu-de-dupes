let parfumsData = {
    homme: [],
    femme: []
};

async function loadParfumsData() {
    try {
        // SÉCURITÉ: Utiliser l'API publique opensheet.elk.sh au lieu d'exposer une clé API
        // Cette méthode ne nécessite pas de clé API et fonctionne avec les Google Sheets publiques
        const sheetId = '11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI';
        const url = `https://opensheet.elk.sh/${sheetId}/1`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const entries = await response.json();
    
        // Vider les données existantes
        parfumsData.homme = [];
        parfumsData.femme = [];

        // SÉCURITÉ: Validation et sanitisation des données
        entries.forEach(entry => {
            // Valider que l'entrée est un objet valide
            if (!entry || typeof entry !== 'object') return;

            const categorie = String(entry.categorie || '').toLowerCase();
            const numero = String(entry.numero || '').trim();
            const nom = String(entry.nom || '').trim();
            const marque = String(entry.marque || '').trim();

            // Validation: ignorer les entrées invalides
            if (!categorie || !numero || !nom || !marque) return;
            if (nom.length > 200 || marque.length > 100) return; // Limite de longueur

            // Vérifier si la catégorie existe dans notre structure
            if (parfumsData[categorie]) {
                parfumsData[categorie].push({
                    numero: numero,
                    nom: nom,
                    marque: marque
                });
            }
        });

        if (process.env.NODE_ENV === 'development') {
            console.log('Données chargées avec succès:', parfumsData);
        }
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Erreur lors du chargement des données:', error);
        }
        // Afficher un message d'erreur accessible à l'utilisateur
        showUserMessage('Erreur lors du chargement des données. Veuillez rafraîchir la page.', 'error');
    }
}

// Fonction pour afficher un message accessible à l'utilisateur
function showUserMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `user-message user-message-${type}`;
    messageDiv.setAttribute('role', type === 'error' ? 'alert' : 'status');
    messageDiv.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    messageDiv.textContent = message;

    document.body.insertBefore(messageDiv, document.body.firstChild);

    // Retirer le message après 5 secondes
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// ACCESSIBILITÉ: Gestion du focus pour les modales
let lastFocusedElement = null;

function openModal(type) {
    const modalId = 'modal' + type.charAt(0).toUpperCase() + type.slice(1);
    const modal = document.getElementById(modalId);

    // Sauvegarder l'élément qui avait le focus
    lastFocusedElement = document.activeElement;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // ACCESSIBILITÉ: Focus sur le bouton de fermeture
    setTimeout(() => {
        const closeButton = modal.querySelector('.close');
        if (closeButton) {
            closeButton.focus();
        }
    }, 100);

    // ACCESSIBILITÉ: Piéger le focus dans la modale
    modal.addEventListener('keydown', trapFocus);
}

function closeModal(type) {
    const modalId = 'modal' + type.charAt(0).toUpperCase() + type.slice(1);
    const modal = document.getElementById(modalId);

    modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    // Retirer le piège de focus
    modal.removeEventListener('keydown', trapFocus);

    // ACCESSIBILITÉ: Restaurer le focus à l'élément précédent
    if (lastFocusedElement) {
        setTimeout(() => {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }, 100);
    }
}

// ACCESSIBILITÉ: Fonction pour piéger le focus dans la modale
function trapFocus(event) {
    if (event.key !== 'Tab') return;

    const modal = event.currentTarget;
    const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
        // Tab + Shift
        if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        }
    } else {
        // Tab seul
        if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }
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

    if (!parfumsData[type] || parfumsData[type].length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Aucun parfum trouvé dans cette catégorie';
        li.className = 'empty-message';
        list.appendChild(li);
        return;
    }

    // Trier les parfums par marque puis par nom
    const sortedParfums = [...parfumsData[type]].sort((a, b) => {
        if (a.marque === b.marque) {
            return a.nom.localeCompare(b.nom);
        }
        return a.marque.localeCompare(b.marque);
    });

    // SÉCURITÉ: Utiliser createElement et textContent au lieu de innerHTML
    sortedParfums.forEach(parfum => {
        const li = document.createElement('li');

        // Numéro
        const numeroSpan = document.createElement('span');
        numeroSpan.className = 'parfum-numero';
        numeroSpan.textContent = parfum.numero;
        numeroSpan.setAttribute('aria-label', `Numéro ${parfum.numero}`);

        // Nom
        const nameSpan = document.createElement('span');
        nameSpan.className = 'parfum-name';

        const evoqueSpan = document.createElement('span');
        evoqueSpan.textContent = 'Évoque';
        evoqueSpan.className = 'evoque-label';

        nameSpan.appendChild(evoqueSpan);
        nameSpan.appendChild(document.createTextNode(' ' + parfum.nom));

        // Marque
        const brandSpan = document.createElement('span');
        brandSpan.className = 'parfum-brand';
        brandSpan.textContent = parfum.marque;

        // Assembler
        li.appendChild(numeroSpan);
        li.appendChild(nameSpan);
        li.appendChild(brandSpan);

        list.appendChild(li);
    });

    // Annoncer le nombre de parfums chargés (accessibilité)
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `${sortedParfums.length} parfums ${type === 'homme' ? 'masculins' : 'féminins'} affichés, triés par marque`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadParfumsData()
        .then(() => {
            createParfumList('homme');
            createParfumList('femme');
        })
        .catch(error => console.error('Error loading data:', error));
});