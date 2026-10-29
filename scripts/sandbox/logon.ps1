# scripts/sandbox/logon.ps1
#
# Runs inside Windows Sandbox at logon (key-check.wsb's LogonCommand, written
# by scripts/sandbox/key-check-sandbox.mjs). Reads C:\run\job.json, finds
# or installs AutoHotkey 1.1, Node, Chrome, Firefox and Edge, runs the AHK
# script on the sandbox's desktop, and writes the reserved-key note.
# Notes go to C:\notes (docs\notes on the host), the event log, logs and
# status to C:\run. Ends with C:\run\done.json, which the host waits for, and
# shuts the sandbox down if the run worked.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = 'C:\hotkey-router'
$Run = 'C:\run'
$Cache = "$Run\cache"
Start-Transcript -Path "$Run\logon.log" -Force | Out-Null

function Status($text) {
  Write-Host $text
  Set-Content -Path "$Run\status.txt" -Value $text -Encoding UTF8
}

function Finish($ok, $message) {
  Get-ChildItem "$env:TEMP\hotkey-router-key-check\*.log" -ErrorAction SilentlyContinue | Copy-Item -Destination $Run
  Status ($(if ($ok) { 'done' } else { 'failed' }) + ": $message")
  @{ ok = $ok; message = $message } | ConvertTo-Json | Set-Content -Path "$Run\done.json" -Encoding UTF8
  Stop-Transcript | Out-Null
  if ($ok) { shutdown.exe /s /t 5 }
  exit
}

# Installers for what the host didn't map, kept in C:\run\cache between runs.
function Fetch($url, $file) {
  $path = "$Cache\$file"
  if (-not (Test-Path $path)) {
    Status "downloading $file"
    New-Item -ItemType Directory -Force $Cache | Out-Null
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile "$path.part"
    Move-Item "$path.part" $path
  }
  $path
}

function Install($name, $exe, $install) {
  if (Test-Path $exe) { return }
  Status "installing $name"
  & $install
  if (-not (Test-Path $exe)) { Finish $false "could not install $name ($exe missing)" }
}

try {
  $job = Get-Content "$Run\job.json" -Raw | ConvertFrom-Json
  Status "starting $($job.script) $($job.args -join ' ')"

  $ahk = 'C:\tools\AutoHotkey\AutoHotkey.exe'
  Install 'AutoHotkey 1.1' $ahk {
    $setup = Fetch 'https://www.autohotkey.com/download/ahk-install.exe' 'ahk-install.exe'
    Start-Process $setup -ArgumentList '/S', '/D=C:\tools\AutoHotkey' -Wait
  }
  $node = 'C:\tools\nodejs\node.exe'
  Install 'Node' $node {
    $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json' | Where-Object { $_.lts } | Select-Object -First 1).version
    $zip = Fetch "https://nodejs.org/dist/$lts/node-$lts-win-x64.zip" "node-$lts-win-x64.zip"
    Expand-Archive $zip -DestinationPath 'C:\tools' -Force
    Move-Item "C:\tools\node-$lts-win-x64" 'C:\tools\nodejs'
  }
  Install 'Chrome' 'C:\Program Files\Google\Chrome\Application\chrome.exe' {
    $msi = Fetch 'https://dl.google.com/dl/chrome/install/googlechromestandaloneenterprise64.msi' 'chrome.msi'
    Start-Process msiexec.exe -ArgumentList '/i', $msi, '/qn' -Wait
  }
  Install 'Firefox' 'C:\Program Files\Mozilla Firefox\firefox.exe' {
    $setup = Fetch 'https://download.mozilla.org/?product=firefox-latest-ssl&os=win64&lang=en-US' 'firefox-setup.exe'
    Start-Process $setup -ArgumentList '/S' -Wait
  }
  Install 'Edge' 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' {
    $msi = Fetch 'https://go.microsoft.com/fwlink/?LinkID=2093437' 'edge.msi'
    Start-Process msiexec.exe -ArgumentList '/i', $msi, '/qn' -Wait
  }

  # The AHK script starts the results server with "node", and the server and
  # the report read these two.
  $env:Path = "C:\tools\nodejs;$env:Path"
  $env:KEY_CHECK_NOTES = 'C:\notes'
  $env:KEY_CHECK_PROBE_LOG = "$Run\probe.jsonl"

  # Let the desktop settle before the script starts bringing windows forward.
  Start-Sleep -Seconds 10
  Status "running $($job.script) $($job.args -join ' ')"
  $ahkArgs = @("`"$Repo\scripts\$($job.script)`"") + @($job.args)
  Start-Process $ahk -ArgumentList $ahkArgs -WorkingDirectory $Repo -Wait

  $logName = if ($job.script -eq 'key-check-reserved.ahk') { 'run-reserved.log' } else { 'run.log' }
  $stopped = Select-String -Path "$env:TEMP\hotkey-router-key-check\$logName" -Pattern 'stopped: (.*)' -ErrorAction SilentlyContinue | Select-Object -Last 1
  if ($stopped) { Finish $false "the script stopped: $($stopped.Matches[0].Groups[1].Value)" }

  if ($job.script -eq 'key-check-reserved.ahk') {
    Status 'writing the note'
    $out = & $node "$Repo\scripts\key-check-reserved-report.mjs" 2>&1
    if ($LASTEXITCODE -ne 0) { Finish $false "the report failed: $out" }
    Finish $true ($out -join ' ')
  }
  Finish $true 'notes written by the page'
} catch {
  Finish $false "$_"
}
