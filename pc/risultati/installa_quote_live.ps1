# Crea su Windows l'attivita' pianificata "Quote live Profit Tracker": lancia quote_live.py ogni minuto.
# Se non ci sono segnali nuovi esce subito (nessuna chiamata ad API-Football). Se il PC e' spento non succede niente.
# Come si lancia: tasto destro sul file > "Esegui con PowerShell"   (oppure da PowerShell:  .\installa_quote_live.ps1)
$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) { $Python = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $Python) { Write-Host "Python non trovato: installalo da python.org (spunta 'Add Python to PATH') e rilancia." -ForegroundColor Red; exit 1 }
# pythonw = senza finestra nera che lampeggia ogni minuto
$PythonW = Join-Path (Split-Path $Python) "pythonw.exe"
if (Test-Path $PythonW) { $Python = $PythonW }

$Script = Join-Path $PSScriptRoot "quote_live.py"
$Azione = New-ScheduledTaskAction -Execute $Python -Argument "`"$Script`"" -WorkingDirectory $PSScriptRoot
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$Impostazioni = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Quote live Profit Tracker" -Action $Azione -Trigger $Trigger -Settings $Impostazioni -Force | Out-Null
Write-Host "Fatto: quote_live.py parte ogni minuto (log in quote_live.log, scrive solo quando ci sono segnali nuovi)." -ForegroundColor Green
Write-Host "Per fermarlo:  Unregister-ScheduledTask -TaskName 'Quote live Profit Tracker' -Confirm:`$false"
