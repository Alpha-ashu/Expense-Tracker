$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$serverProcess = Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'npm run dev' -PassThru -WindowStyle Hidden

try {
  $healthy = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      Invoke-RestMethod -Uri 'http://localhost:3000/health' -Method Get | Out-Null
      $healthy = $true
      break
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  if (-not $healthy) {
    throw 'Backend did not become healthy in time'
  }

  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-feature-matrix.ps1')
} finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
