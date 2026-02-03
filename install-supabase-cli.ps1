#!/usr/bin/env pwsh
# Supabase CLI Installation Script for Windows
# This script will install Scoop (if not present) and Supabase CLI

Write-Host "🚀 Installing Supabase CLI..." -ForegroundColor Green

# Check if Scoop is installed
try {
    $scoopVersion = scoop --version 2>$null
    Write-Host "✅ Scoop is already installed: $scoopVersion" -ForegroundColor Green
} catch {
    Write-Host "📦 Installing Scoop package manager..." -ForegroundColor Yellow
    
    # Install Scoop
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
    
    # Add Scoop to current session PATH
    $env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"
    
    Write-Host "✅ Scoop installed successfully!" -ForegroundColor Green
}

# Install Supabase CLI
Write-Host "📥 Installing Supabase CLI via Scoop..." -ForegroundColor Yellow

# Refresh Scoop buckets
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git 2>$null

# Install Supabase
scoop install supabase

# Verify installation
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI installed successfully!" -ForegroundColor Green
    Write-Host "Version: $supabaseVersion" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Installation failed. Trying alternative method..." -ForegroundColor Red
    
    # Alternative: Download from GitHub
    Write-Host "📥 Downloading Supabase CLI from GitHub..." -ForegroundColor Yellow
    $downloadUrl = "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe"
    $installPath = "$env:USERPROFILE\bin"
    $exePath = "$installPath\supabase.exe"
    
    # Create bin directory if it doesn't exist
    if (!(Test-Path $installPath)) {
        New-Item -ItemType Directory -Path $installPath -Force | Out-Null
    }
    
    # Download the file
    Invoke-WebRequest -Uri $downloadUrl -OutFile $exePath
    
    # Add to PATH
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$installPath*") {
        [Environment]::SetEnvironmentVariable("PATH", "$userPath;$installPath", "User")
        Write-Host "✅ Added $installPath to PATH" -ForegroundColor Green
    }
    
    Write-Host "✅ Supabase CLI installed to $exePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open a NEW terminal/PowerShell window (to reload PATH)" -ForegroundColor White
Write-Host "2. Run: supabase --version" -ForegroundColor White
Write-Host "3. Run: supabase login" -ForegroundColor White
Write-Host "4. Run: supabase link --project-ref bkxdsxnxrtcqnkdcdist" -ForegroundColor White
Write-Host ""
Write-Host "Common commands:" -ForegroundColor Yellow
Write-Host "- supabase db push          # Push migrations to production" -ForegroundColor White
Write-Host "- supabase functions deploy # Deploy edge functions" -ForegroundColor White
Write-Host "- supabase secrets list     # List secrets" -ForegroundColor White
Write-Host "- supabase secrets set      # Set new secret" -ForegroundColor White
