param(
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$appDir = $PSScriptRoot
$appUrl = "http://127.0.0.1:4173/#shelf"
$logPath = Join-Path $appDir ".server.log"
$errorLogPath = Join-Path $appDir ".server-error.log"

function Test-Shiye {
  try {
    $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -eq 200 -and $response.Content -match "reader\.js")
  } catch {
    return $false
  }
}

function Show-LaunchError([string]$message) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      $message,
      "Shiye Reader",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {
    # If the dialog cannot open, the process simply exits.
  }
}

if (-not (Test-Shiye)) {
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }

  if (-not $nodePath) {
    $candidates = @(
      (Join-Path $env:ProgramFiles "nodejs\node.exe"),
      (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
    )
    $nodePath = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  }

  if (-not $nodePath) {
    Show-LaunchError "Node.js was not found. Please install Node.js, or open index.html directly."
    exit 1
  }

  try {
    Start-Process -FilePath $nodePath `
      -ArgumentList @("server.mjs", "--no-open") `
      -WorkingDirectory $appDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $logPath `
      -RedirectStandardError $errorLogPath | Out-Null
  } catch {
    Show-LaunchError "The local reading server could not be started."
    exit 1
  }

  $started = $false
  for ($i = 0; $i -lt 50; $i += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-Shiye) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    Show-LaunchError "The local reading server did not answer on port 4173. The port may be in use by another application."
    exit 1
  }
}

if ($NoOpen) {
  exit 0
}

$browserCandidates = @(
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe")
)

$browser = $browserCandidates |
  Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
  Select-Object -First 1

try {
  if ($browser) {
    Start-Process -FilePath $browser -ArgumentList @("--app=$appUrl", "--window-size=1440,980") | Out-Null
  } else {
    Start-Process $appUrl | Out-Null
  }
} catch {
  Show-LaunchError "The browser could not be opened. Try http://127.0.0.1:4173 in your browser."
  exit 1
}
