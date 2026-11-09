@echo off
cd /d "%~dp0"
py -m pip install -r requirements.txt
if errorlevel 1 goto error
py -m playwright install chromium
if errorlevel 1 goto error
echo Installazione completata.
pause
exit /b 0
:error
echo ERRORE: controlla che Python sia installato e che il comando py funzioni.
pause
