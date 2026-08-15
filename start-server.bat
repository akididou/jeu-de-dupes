@echo off
echo ========================================
echo   JEU DE DUPES - Serveur Local
echo ========================================
echo.

REM Vérifier si Python est installé
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python détecté
    echo.
    echo Démarrage du serveur sur http://localhost:8000
    echo Appuyez sur Ctrl+C pour arrêter le serveur
    echo.
    python -m http.server 8000
    goto :end
)

REM Vérifier si Node.js est installé
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Node.js détecté
    echo.
    echo Installation de 'serve' si nécessaire...
    call npx serve -p 8000
    goto :end
)

REM Vérifier si PHP est installé
php --version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] PHP détecté
    echo.
    echo Démarrage du serveur sur http://localhost:8000
    echo Appuyez sur Ctrl+C pour arrêter le serveur
    echo.
    php -S localhost:8000
    goto :end
)

echo [ERREUR] Aucun serveur disponible
echo.
echo Veuillez installer l'un des éléments suivants:
echo  - Python: https://www.python.org/downloads/
echo  - Node.js: https://nodejs.org/
echo  - PHP: https://www.php.net/downloads
echo.
pause

:end
