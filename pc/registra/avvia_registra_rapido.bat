@echo off
rem Avvia "Registra al volo" nascosto (nessuna finestra nera). Tasto: ALT+R. Log: registra_rapido.log
cd /d "%~dp0"
start "" pythonw registra_rapido.py
