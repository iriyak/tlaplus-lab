# tla.ps1 - PowerShell launcher for tla.ts (needs bun and java). Works in Windows PowerShell 5.1 and PowerShell 7+.
# Usage: tla check examples\DieHard.tla      (see `tla help`)
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'tla.ts'

# Forward pipeline input (e.g. `Get-Content X.tla | tla put X.tla`) to bun's stdin.
if ($MyInvocation.ExpectingInput) {
    $input | & bun $script @args
} else {
    & bun $script @args
}
exit $LASTEXITCODE
