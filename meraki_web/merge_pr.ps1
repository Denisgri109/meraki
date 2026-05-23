# Helper: fetch PR, attempt local merge with given strategy, push, verify close.
# Usage: .\merge_pr.ps1 -Pr <num> -Strategy <ours|theirs|none>
param(
    [Parameter(Mandatory=$true)] [int]$Pr,
    [ValidateSet("ours","theirs","none")] [string]$Strategy = "none",
    [string]$Title = ""
)
$env:Path = "C:\Program Files\GitHub CLI;" + $env:Path
$repo = "Denisgri109/meraki-web"

if (-not $Title) {
    $Title = (gh pr view $Pr --repo $repo --json title --jq .title)
}
$msg = "Merge PR #$Pr`: $Title"

git fetch origin "pull/$Pr/head:pr-$Pr" 2>&1 | Out-Host
$mergeArgs = @("merge","--no-ff","-m",$msg)
if ($Strategy -eq "ours")   { $mergeArgs += @("-X","ours") }
if ($Strategy -eq "theirs") { $mergeArgs += @("-X","theirs") }
$mergeArgs += "pr-$Pr"
git @mergeArgs 2>&1 | Out-Host

if ($LASTEXITCODE -ne 0) {
    Write-Host "Merge had conflicts. Status:" -ForegroundColor Yellow
    git status --short
    exit 1
}
git push origin main 2>&1 | Out-Host
git branch -D "pr-$Pr" 2>&1 | Out-Null
Write-Host "PR #$Pr merged and pushed." -ForegroundColor Green
