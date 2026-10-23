# Crea su Windows l'attivita' pianificata "Risultati Profit Tracker": lancia risultati_partite.py agli orari qui sotto.
# Se il PC e' spento all'orario previsto, l'attivita' parte appena viene riacceso.
# Per cambiare gli orari: modifica la riga $Orari e rilancia questo file (sostituisce l'attivita' esistente).
# Come si lancia: tasto destro sul file > "Esegui con PowerShell"   (oppure da PowerShell:  .\installa_pianificazione.ps1)
$Orari = @("08:00", "12:00", "16:00", "20:00", "00:30")

$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) { $Python = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $Python) { Write-Host "Python non trovato: installalo da python.org (spunta 'Add Python to PATH') e rilancia." -ForegroundColor Red; exit 1 }

$Script = Join-Path $PSScriptRoot "risultati_partite.py"
$Azione = New-ScheduledTaskAction -Execute $Python -Argument "`"$Script`"" -WorkingDirectory $PSScriptRoot
$Trigger = $Orari | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }
$Impostazioni = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Risultati Profit Tracker" -Action $Azione -Trigger $Trigger -Settings $Impostazioni -Force | Out-Null
Write-Host "Fatto. Orari: $($Orari -join ', ')" -ForegroundColor Green
Write-Host "Per provarlo subito:  Start-ScheduledTask -TaskName 'Risultati Profit Tracker'   (il log e' in risultati_partite.log)"
