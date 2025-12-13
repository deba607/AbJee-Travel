# ABjee Travel - Production Deployment Script (PowerShell)

Write-Host "🚀 Starting deployment process..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Check git status
Write-Host "📋 Checking git status..." -ForegroundColor Yellow
$gitStatus = git status -s
if ($gitStatus) {
    Write-Host "⚠️  You have uncommitted changes" -ForegroundColor Yellow
    Write-Host $gitStatus
    $response = Read-Host "Do you want to commit these changes? (y/n)"
    if ($response -eq 'y') {
        $commitMsg = Read-Host "Enter commit message"
        git add .
        git commit -m $commitMsg
    } else {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Build client
Write-Host ""
Write-Host "🔨 Building client..." -ForegroundColor Yellow
Set-Location client
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Client build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Client build successful" -ForegroundColor Green
Set-Location ..

# Step 3: Push to GitHub
Write-Host ""
Write-Host "📤 Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git push failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Pushed to GitHub" -ForegroundColor Green

# Step 4: Deployment instructions
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Code deployed to GitHub!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Netlify (Auto-deploys from GitHub)" -ForegroundColor White
Write-Host "   URL: https://abjee-travels.netlify.app/" -ForegroundColor Gray
Write-Host "   Status: https://app.netlify.com/" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  Render (Auto-deploys from GitHub)" -ForegroundColor White
Write-Host "   URL: https://abjee-travel.onrender.com" -ForegroundColor Gray
Write-Host "   Status: https://dashboard.render.com/" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  Firebase Console" -ForegroundColor White
Write-Host "   ⚠️  IMPORTANT: Add authorized domain!" -ForegroundColor Yellow
Write-Host "   → Go to: https://console.firebase.google.com/" -ForegroundColor Gray
Write-Host "   → Project: abjee-travel-4fc38" -ForegroundColor Gray
Write-Host "   → Authentication → Settings → Authorized domains" -ForegroundColor Gray
Write-Host "   → Add: abjee-travels.netlify.app" -ForegroundColor Gray
Write-Host ""
Write-Host "4️⃣  Verify Deployment" -ForegroundColor White
Write-Host "   → Health check: curl https://abjee-travel.onrender.com/api/health" -ForegroundColor Gray
Write-Host "   → Test login: https://abjee-travels.netlify.app/auth" -ForegroundColor Gray
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "📚 For troubleshooting, see: TROUBLESHOOTING.md" -ForegroundColor Cyan
Write-Host ""
