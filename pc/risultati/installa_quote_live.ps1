# Crea su Windows l'attivita' pianificata "Quote live Profit Tracker": lancia quote_live.py ogni minuto.
# Se non ci sono segnali nuovi esce subito (nessuna chiamata ad API-Football). Se il PC e' spento non succede niente.
# Come si lancia: tasto destro sul file > "Esegui con PowerShell"   (la finestra resta aperta e mostra l'esito o l'errore)
$ErrorActionPreference = 'Stop'
try {
    $Python = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $Python) { $Python = (Get-Command py -ErrorAction SilentlyContinue).Source }
    if (-not $Python) { throw "Python non trovato: installalo da python.org (spunta 'Add Python to PATH') e rilancia." }
    # pythonw = senza finestra nera che lampeggia ogni minuto
    $PythonW = Join-Path (Split-Path $Python) "pythonw.exe"
    if (Test-Path $PythonW) { $Python = $PythonW }
    Write-Host "Python usato: $Python"

    $Script = Join-Path $PSScriptRoot "quote_live.py"
    if (-not (Test-Path $Script)) { throw "Non trovo quote_live.py in $PSScriptRoot" }
    $Azione = New-ScheduledTaskAction -Execute $Python -Argument "`"$Script`"" -WorkingDirectory $PSScriptRoot
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
    $Impostazioni = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName "Quote live Profit Tracker" -Action $Azione -Trigger $Trigger -Settings $Impostazioni -Force | Out-Null

    $t = Get-ScheduledTask -TaskName "Quote live Profit Tracker"
    Start-ScheduledTask -TaskName "Quote live Profit Tracker"
    Write-Host "FATTO: l'attivita' esiste (stato: $($t.State)) e parte ogni minuto. Fra un minuto deve comparire quote_live_ultima.txt in questa cartella." -ForegroundColor Green
    Write-Host "Per fermarla:  Unregister-ScheduledTask -TaskName 'Quote live Profit Tracker' -Confirm:`$false"
} catch {
    Write-Host "ERRORE: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Se dice 'accesso negato': chiudi, tasto destro sul file > Esegui con PowerShell non basta, apri PowerShell come amministratore e lancia:  & '$PSScriptRoot\installa_quote_live.ps1'" -ForegroundColor Yellow
}
Read-Host "Premi Invio per chiudere"
