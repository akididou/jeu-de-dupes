let parfumsData = {
    homme: [],
    femme: []
};

async function loadParfumsData() {
    try {
        const sheetId = '11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI';
        const sheetNumber = 1; // Commence à 1 pour la première feuille
        
        // Cette URL spéciale convertit la feuille Google en JSON
        const url = `https://spreadsheets.google.com/feeds/list/${sheetId}/${sheetNumber}/public/values?alt=json`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        const entries = data.feed.entry || [];
        
        // Vider les données existantes
        parfumsData.homme = [];
        parfumsData.femme = [];
        
        // Traiter chaque entrée (ligne)
        entries.forEach(entry => {
            // Les colonnes seront accessibles sous la forme gsx$nomcolonne
            // Les noms de colonnes sont en minuscules sans espaces
            const categorie = entry.gsx$categorie.$t;
            const numero = entry.gsx$numero.$t;
            const nom = entry.gsx$nom.$t;
            const marque = entry.gsx$marque.$t;
            
            // Vérifier si la catégorie existe dans notre structure
            if (parfumsData[categorie]) {
                parfumsData[categorie].push({
                    numero,
                    nom,
                    marque
                });
            }
        });
        
        console.log('Données chargées avec succès:', parfumsData);
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        
        // En cas d'erreur, essayer avec la nouvelle API v4 JSON
        try {
            await loadParfumsDataAlternative();
        } catch (secondError) {
            console.error('Échec également avec la méthode alternative:', secondError);
        }
    }
}

// Méthode alternative utilisant une autre URL de Google Sheets
async function loadParfumsDataAlternative() {
    const sheetId = '11QQ55WHs43F2B-M8TdxmKHM42U5h7QoWmHlSBAKt3MI';
    
    // Format alternatif qui fonctionne souvent mieux
    const url = `https://opensheet.elk.sh/${sheetId}/1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const entries = await response.json();
    
    // Vider les données existantes
    parfumsData.homme = [];
    parfumsData.femme = [];
    
    // Traiter chaque entrée (ligne)
    entries.forEach(entry => {
        const categorie = entry.categorie;
        const numero = entry.numero;
        const nom = entry.nom;
        const marque = entry.marque;
        
        // Vérifier si la catégorie existe dans notre structure
        if (parfumsData[categorie]) {
            parfumsData[categorie].push({
                numero,
                nom,
                marque
            });
        }
    });
    
    console.log('Données chargées avec succès (méthode alternative):', parfumsData);
}

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
    
    if (!parfumsData[type] || parfumsData[type].length === 0) {
        list.innerHTML = '<li>Aucun parfum trouvé dans cette catégorie</li>';
        return;
    }
    
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
    loadParfumsData()
        .then(() => {
            createParfumList('homme');
            createParfumList('femme');
        })
        .catch(error => console.error('Error loading data:', error));
});