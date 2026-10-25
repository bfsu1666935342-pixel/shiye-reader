$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot
$launchPath = Join-Path $appDir "launch.ps1"
$iconPath = Join-Path $appDir "icons\shiye.ico"
$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path -LiteralPath $launchPath)) {
  throw "launch.ps1 was not found."
}

$shortcutName = -join ([char[]](0x62FE, 0x9875)) + ".lnk"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop $shortcutName

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launchPath`""
$shortcut.WorkingDirectory = $appDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Shiye Reader - EPUB and bilingual reading"
$shortcut.WindowStyle = 7
$shortcut.Save()

Write-Host "Desktop shortcut created:"
Write-Host $shortcutPath
