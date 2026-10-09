' Avvia il lettore Telegram Accademia SENZA finestra nera. Da usare SOLO dopo aver fatto il primo accesso a Telegram con accademia_reader.bat.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
q = Chr(34)
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "pythonw " & q & dir & "\accademia_reader.py" & q, 0, False
