@echo off
rem Lancia la ricerca dei risultati a mano (con la finestra visibile). Con  --prova  non scrive niente sul sito.
cd /d "%~dp0"
python risultati_partite.py %*
echo.
pause
