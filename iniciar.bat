@echo off
title Descargador de Telegram
echo Iniciando Descargador de Series de Telegram...
echo =================================================

:: Cambiar al directorio donde esta el .bat
cd /d "%~dp0"

:: Instalar dependencias si faltan
echo Verificando dependencias web...
pip install -r requirements.txt --quiet

:: Iniciar servidor y abrir navegador
echo Abriendo aplicacion en el navegador...
start http://localhost:8000
python -m uvicorn app:app --host 127.0.0.1 --port 8000

echo.
echo =================================================
pause
