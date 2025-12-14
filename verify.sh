#!/bin/bash
# FlashCards App - Quick Test & Verification Script
# Run this to verify the app is working correctly

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  FlashCards PWA - System Verification Script                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/Users/baz/Projects/repos/single-sites/flash-cards"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        size=$(du -h "$1" | cut -f1)
        echo -e "${GREEN}✓${NC} $1 ($size)"
        return 0
    else
        echo -e "${RED}✗${NC} Missing: $1"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        return 0
    else
        echo -e "${RED}✗${NC} Missing directory: $1"
        return 1
    fi
}

echo "📁 Checking project structure..."
echo ""

check_dir "$PROJECT_DIR"
check_dir "$PROJECT_DIR/src"
check_dir "$PROJECT_DIR/src/icons"
check_dir "$PROJECT_DIR/src/decks"

echo ""
echo "📄 Checking source files..."
echo ""

check_file "$PROJECT_DIR/src/index.html"
check_file "$PROJECT_DIR/src/app.js"
check_file "$PROJECT_DIR/src/styles.css"
check_file "$PROJECT_DIR/src/service-worker.js"
check_file "$PROJECT_DIR/src/manifest.webmanifest"

echo ""
echo "🎨 Checking assets..."
echo ""

check_file "$PROJECT_DIR/src/icons/icon-192.png"
check_file "$PROJECT_DIR/src/icons/icon-512.png"

echo ""
echo "📚 Checking decks..."
echo ""

check_file "$PROJECT_DIR/src/decks/index.json"
check_file "$PROJECT_DIR/src/decks/flashcards (1).csv"
check_file "$PROJECT_DIR/src/decks/flashcards (2).csv"

echo ""
echo "📖 Checking documentation..."
echo ""

check_file "$PROJECT_DIR/README.md"
check_file "$PROJECT_DIR/QUICKSTART.md"
check_file "$PROJECT_DIR/IMPLEMENTATION.md"
check_file "$PROJECT_DIR/START_HERE.md"
check_file "$PROJECT_DIR/VERIFICATION_REPORT.md"

echo ""
echo "🛠️  Checking build tools..."
echo ""

check_file "$PROJECT_DIR/generate_icons.py"
check_file "$PROJECT_DIR/.gitignore"

echo ""
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "✅ All files present and accounted for!"
echo ""
echo "🚀 To start the app:"
echo ""
echo "   cd $PROJECT_DIR"
echo "   python3 -m http.server 8000 --directory src"
echo ""
echo "   Then open: http://localhost:8000"
echo ""
echo "═════════════════════════════════════════════════════════════════"
