param([switch]$Execute)

$ErrorActionPreference = 'Stop'
$team = 'kiliansosas-projects'
$inert = 'typescript-lab-runner-preview-4u2490oc2-kiliansosas-projects.vercel.app'
$alias = 'typescript-lab-m3-runner-qa.vercel.app'
$confirmedId = 'dpl_4bj2D2yd12FQQFo1U3q7MbPXU9Po'

Write-Output "Emergency containment target: $alias -> $inert ($confirmedId)."
Write-Warning 'This does NOT remove a Vercel Deployment Protection Exception. The inert page may remain public.'

if (-not $Execute) {
  Write-Output 'Dry run. To perform the authorized emergency fallback, rerun with -Execute and confirm interactively.'
  Write-Output 'Afterward, verify the alias deployment ID using authenticated Vercel project tools.'
  exit 0
}

$confirmation = Read-Host "Type RESTORE-RUNNER-QA-TO-INERT to authorize only the runner QA alias change"
if ($confirmation -cne 'RESTORE-RUNNER-QA-TO-INERT') {
  throw 'No confirmation provided; alias unchanged.'
}

& npx.cmd --yes vercel@64.5.0 alias set $inert $alias --scope $team
if ($LASTEXITCODE -ne 0) { throw 'Alias restoration command failed. Escalate and retry through the Vercel dashboard.' }

Write-Output 'Alias restoration command succeeded; still require independent Vercel alias-ID readback.'
Write-Warning 'Do not declare protection restored until the exception is removed and an unauthenticated SSO 302 is verified.'
