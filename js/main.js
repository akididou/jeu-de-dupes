let parfumsData = {
    homme: [],
    femme: []
};

async function loadParfumsData() {
    try {
        const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
        const sheetId = process.env.GOOGLE_SHEETS_ID;
        const sheetName = 'data';
        
        // URL pour l'API Sheets v4
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`;
        
        // OU utilisez cette URL qui ne nécessite pas de clé API si le document est public
        // const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Vider les données existantes
        parfumsData.homme = [];
        parfumsData.femme = [];
        
        // Interpréter les données (adaptez selon le format retourné)
        const rows = data.values || [];
        
        // La première ligne contient les en-têtes
        const headers = rows[0];
        
        // Traiter chaque ligne à partir de l'index 1 (après les en-têtes)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 4) continue; // Ignorer les lignes incomplètes
            
            const categorie = row[0];
            const numero = row[1];
            const nom = row[2];
            const marque = row[3];
            
            if (parfumsData[categorie]) {
                parfumsData[categorie].push({
                    numero,
                    nom,
                    marque
                });
            }
        }
        
        console.log('Données chargées avec succès:', parfumsData);
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        
        // En cas d'erreur, essayer la méthode alternative
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
    
    // Trier les parfums par marque puis par nom
    const sortedParfums = [...parfumsData[type]].sort((a, b) => {
        if (a.marque === b.marque) {
            return a.nom.localeCompare(b.nom);
        }
        return a.marque.localeCompare(b.marque);
    });
    
    sortedParfums.forEach(parfum => {
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