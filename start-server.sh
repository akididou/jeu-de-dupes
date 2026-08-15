#!/bin/bash

echo "========================================"
echo "  JEU DE DUPES - Serveur Local"
echo "========================================"
echo ""

# Vérifier si Python est installé
if command -v python3 &> /dev/null; then
    echo "[OK] Python détecté"
    echo ""
    echo "Démarrage du serveur sur http://localhost:8000"
    echo "Appuyez sur Ctrl+C pour arrêter le serveur"
    echo ""
    python3 -m http.server 8000
    exit 0
fi

# Vérifier si Node.js est installé
if command -v node &> /dev/null; then
    echo "[OK] Node.js détecté"
    echo ""
    echo "Installation de 'serve' si nécessaire..."
    npx serve -p 8000
    exit 0
fi

# Vérifier si PHP est installé
if command -v php &> /dev/null; then
    echo "[OK] PHP détecté"
    echo ""
    echo "Démarrage du serveur sur http://localhost:8000"
    echo "Appuyez sur Ctrl+C pour arrêter le serveur"
    echo ""
    php -S localhost:8000
    exit 0
fi

echo "[ERREUR] Aucun serveur disponible"
echo ""
echo "Veuillez installer l'un des éléments suivants:"
echo " - Python: https://www.python.org/downloads/"
echo " - Node.js: https://nodejs.org/"
echo " - PHP: https://www.php.net/downloads"
echo ""
exit 1
