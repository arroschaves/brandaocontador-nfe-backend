$ErrorActionPreference = 'Stop'
$headers = @{ 'User-Agent' = 'TraeAI' }
$url = 'https://api.github.com/repos/arroschaves/brandaocontador-nfe-frontend/commits?sha=main&per_page=5'
$commits = Invoke-RestMethod -Headers $headers -Uri $url
foreach ($c in $commits) {
  Write-Host ("Commit: {0} - {1}" -f $c.sha.Substring(0,7), $c.commit.message)
}