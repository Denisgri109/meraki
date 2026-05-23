$env:Path = "C:\Program Files\GitHub CLI;" + $env:Path
$ErrorActionPreference = "Continue"
$repo = "Denisgri109/meraki-web"
$results = @()
foreach ($n in 5..37) {
    Write-Host "===== PR #$n =====" -ForegroundColor Cyan
    $state = (gh pr view $n --repo $repo --json state 2>$null | ConvertFrom-Json).state
    if ($state -ne "OPEN") {
        Write-Host "  state=$state, skipping" -ForegroundColor Yellow
        $results += [pscustomobject]@{ pr=$n; result="skip-$state" }
        continue
    }
    $out = gh pr merge $n --repo $repo --merge --admin --delete-branch 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  MERGED" -ForegroundColor Green
        $results += [pscustomobject]@{ pr=$n; result="merged"; output=$out }
    } else {
        Write-Host "  FAILED: $out" -ForegroundColor Red
        $results += [pscustomobject]@{ pr=$n; result="failed"; output=$out }
    }
}
$results | ConvertTo-Json -Depth 4 | Out-File merge_results.json -Encoding utf8
Write-Host "`n===== SUMMARY =====" -ForegroundColor Cyan
$results | Group-Object result | ForEach-Object { Write-Host ("{0}: {1}" -f $_.Name, $_.Count) }
Write-Host "Failed PRs:"
$results | Where-Object { $_.result -eq "failed" } | ForEach-Object { Write-Host ("  #{0}" -f $_.pr) }
