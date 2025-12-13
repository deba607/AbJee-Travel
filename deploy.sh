#!/bin/bash

# ABjee Travel - Production Deployment Script

echo "🚀 Starting deployment process..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check git status
echo "📋 Checking git status..."
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
    git status -s
    read -p "Do you want to commit these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " commit_msg
        git add .
        git commit -m "$commit_msg"
    else
        echo -e "${RED}❌ Deployment cancelled${NC}"
        exit 1
    fi
fi

# Step 2: Build client
echo ""
echo "🔨 Building client..."
cd client
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Client build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Client build successful${NC}"
cd ..

# Step 3: Push to GitHub
echo ""
echo "📤 Pushing to GitHub..."
git push origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git push failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Pushed to GitHub${NC}"

# Step 4: Deployment instructions
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Code deployed to GitHub!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo ""
echo "1️⃣  Netlify (Auto-deploys from GitHub)"
echo "   URL: https://abjee-travels.netlify.app/"
echo "   Status: https://app.netlify.com/"
echo ""
echo "2️⃣  Render (Auto-deploys from GitHub)"
echo "   URL: https://abjee-travel.onrender.com"
echo "   Status: https://dashboard.render.com/"
echo ""
echo "3️⃣  Firebase Console"
echo "   ⚠️  IMPORTANT: Add authorized domain!"
echo "   → Go to: https://console.firebase.google.com/"
echo "   → Project: abjee-travel-4fc38"
echo "   → Authentication → Settings → Authorized domains"
echo "   → Add: abjee-travels.netlify.app"
echo ""
echo "4️⃣  Verify Deployment"
echo "   → Health check: curl https://abjee-travel.onrender.com/api/health"
echo "   → Test login: https://abjee-travels.netlify.app/auth"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 For troubleshooting, see: TROUBLESHOOTING.md"
echo ""
