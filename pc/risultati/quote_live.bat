@echo off
rem Lancia a mano la lettura delle quote live. Con  --prova  non scrive niente sul sito.
cd /d "%~dp0"
python quote_live.py %*
echo.
pause
