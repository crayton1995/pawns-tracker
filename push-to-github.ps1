# push-to-github.ps1
# One-shot script to push this project to https://github.com/crayton1995/pawns-tracker
# Run from PowerShell:  .\push-to-github.ps1
# (If PowerShell blocks it, run once: Set-ExecutionPolicy -Scope Process Bypass)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "=== Pawns Replays: push to GitHub ===" -ForegroundColor Cyan
Write-Host "Working directory: $PSScriptRoot" -ForegroundColor DarkGray

# 1. Clean up any leftover .git folder from previous failed attempts
if (Test-Path .git) {
    Write-Host "`nRemoving existing .git folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .git
}

# 2. Initialize repo
Write-Host "`nInitializing repo..." -ForegroundColor Green
git init | Out-Null
git config user.email "crayton8520@gmail.com"
git config user.name  "crayton1995"
git branch -M main

# 3. Stage everything (respecting .gitignore)
Write-Host "`nStaging files..." -ForegroundColor Green
git add .

# 4. Sanity check: no node_modules should be staged
$badFiles = git diff --cached --name-only | Select-String -Pattern 'node_modules'
if ($badFiles) {
    Write-Host "`nABORT: node_modules ended up in the staging area." -ForegroundColor Red
    Write-Host "Check .gitignore. Sample bad entries:" -ForegroundColor Red
    $badFiles | Select-Object -First 5
    exit 1
}

$count = (git diff --cached --name-only | Measure-Object).Count
Write-Host "Staged $count files." -ForegroundColor Green
Write-Host "`nFiles to commit:" -ForegroundColor DarkGray
git diff --cached --name-only | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

# 5. Commit
Write-Host "`nCommitting..." -ForegroundColor Green
git commit -m "Initial commit: Pawns Replays extension, webapp, and Supabase schema" | Out-Null

# 6. Wire up remote and push
Write-Host "`nWiring up remote..." -ForegroundColor Green
git remote add origin https://github.com/crayton1995/pawns-tracker.git

Write-Host "`nPushing to GitHub..." -ForegroundColor Green
Write-Host "(A browser window or credential prompt may appear for GitHub auth.)" -ForegroundColor DarkGray
git push -u origin main

Write-Host "`n=== Done. Check https://github.com/crayton1995/pawns-tracker ===" -ForegroundColor Cyan
