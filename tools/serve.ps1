# Serves the static site on the LAN, using the Node runtime that ships with
# DeepSeek Harness. That binary already has an inbound firewall rule, so no
# firewall change and no elevation is needed.
#
#   powershell -NoProfile -File tools\serve.ps1
#   powershell -NoProfile -File tools\serve.ps1 -Port 8081
#
# Then open the printed http://<lan-ip>:<port>/ on any device in the LAN.

param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

$script = Join-Path $PSScriptRoot 'serve.js'
if (-not (Test-Path -LiteralPath $script)) {
  throw "serve.js not found next to this script: $script"
}

# Prefer the bundled runtime (covered by the existing firewall rule).
$bundled = $env:DSH_NODE_EXECUTABLE
if ($bundled -and (Test-Path -LiteralPath $bundled)) {
  $env:ELECTRON_RUN_AS_NODE = '1'
  & $bundled $script $Port
  exit $LASTEXITCODE
}

# Fall back to a system Node.js if the harness one is not available.
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  & $node.Source $script $Port
  exit $LASTEXITCODE
}

throw "No Node runtime found. Install Node.js, or run this from a DeepSeek Harness session."
