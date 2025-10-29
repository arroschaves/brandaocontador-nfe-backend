$ErrorActionPreference = 'Stop'

$owner = 'arroschaves'
$repo = 'brandaocontador-nfe-backend'
$workflow = 'deploy-frontend.yml'
$headers = @{ 'User-Agent' = 'TraeAI' }

$runs = Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$owner/$repo/actions/workflows/$workflow/runs?per_page=10"
if (-not $runs.workflow_runs) {
  Write-Host "Nenhum run encontrado."
  exit 0
}

$latest = $runs.workflow_runs | Sort-Object -Property created_at -Descending | Select-Object -First 1

Write-Host "Run ID: $($latest.id)"
Write-Host "Status: $($latest.status) Conclusion: $($latest.conclusion)"
Write-Host "Event: $($latest.event)"
Write-Host "Head commit: $($latest.head_commit.message)"

$jobs = Invoke-RestMethod -Headers $headers -Uri $latest.jobs_url
foreach ($j in $jobs.jobs) {
  Write-Host ("Job: {0} status={1} conclusion={2}" -f $j.name, $j.status, $j.conclusion)
  if ($j.steps) {
    foreach ($s in $j.steps) {
      Write-Host ("  - Step: {0} status={1} conclusion={2}" -f $s.name, $s.status, $s.conclusion)
    }
  }
}

$resp = Invoke-WebRequest -UseBasicParsing -Uri "https://nfe.brandaocontador.com.br"
Write-Host "Frontend status: $($resp.StatusCode)"
Write-Host ("Headers: server={0} x-vercel-id={1} x-vercel-cache={2} cache-control={3}" -f $resp.Headers['server'], $resp.Headers['x-vercel-id'], $resp.Headers['x-vercel-cache'], $resp.Headers['cache-control'])