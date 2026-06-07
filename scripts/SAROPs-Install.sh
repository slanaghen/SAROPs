#!/bin/bash

# SAROps System Installation Script
# This script installs all pre-requisites for the SAROps development environment.
# Primary target: macOS with Homebrew.

set -e # Exit immediately if a command exits with a non-zero status.

echo "--- Starting SAROps Installation ---"

# 1. Check for Homebrew (The package manager for macOS)
if ! command -v brew &> /dev/null; then
    echo "🍺 Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add brew to path for the current session (for Apple Silicon Macs)
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    echo "✅ Homebrew is already installed."
fi

# 2. Update Homebrew
echo "--- Updating Homebrew repositories ---"
brew update

# 3. Install Node.js and npm
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js (LTS)..."
    brew install node
else
    echo "✅ Node.js is already installed ($(node -v))."
fi

# 4. Install Docker Desktop (Required for Supabase local stack)
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker Desktop via Homebrew Cask..."
    brew install --cask docker
    echo "⚠️  Action Required: Please launch Docker Desktop from your Applications folder to complete the installation."
else
    echo "✅ Docker is already installed."
fi

# 5. Install PostgreSQL Client (psql)
if ! command -v psql &> /dev/null; then
    echo "🐘 Installing PostgreSQL client..."
    brew install postgresql@16
else
    echo "✅ PostgreSQL client is already installed."
fi

# 5. Install Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "⚡ Installing Supabase CLI..."
    brew install supabase/tap/supabase
else
    echo "✅ Supabase CLI is already installed ($(supabase -v))."
fi

# 6. Install Project Dependencies (npm)
echo "--- Installing Project-specific npm dependencies ---"
# Navigate to the project root relative to this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

if [ -f "package.json" ]; then
    npm install
    echo "✅ npm dependencies successfully installed."
else
    echo "❌ Error: package.json not found in $PROJECT_ROOT."
    exit 1
fi

echo ""
echo "--- 🚀 Installation Complete 🚀 ---"
echo "Next steps to get the system running:"
echo "1. Ensure Docker Desktop is running."
echo "2. Run './scripts/SAROPs-Start-Services.sh' to start the local database."
echo "3. Run './reinit-db.sh' to initialize the schema and seed data."
echo "4. Run 'npm run dev' to launch the web application."
echo ""
echo "Happy coding!"