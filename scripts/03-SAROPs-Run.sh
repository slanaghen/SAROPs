#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Function to be called on script exit
cleanup() {
    echo "🧹 Cleaning up..."
    popd
}

# Register the cleanup function to be called on EXIT signal
trap cleanup EXIT

# pushd to the project root directory (adjust if this script is located elsewhere)
pushd `git rev-parse --show-toplevel` || exit

echo "🚀 Running npm install..."
npm install 
echo "✅ Success: npm install completed."

 # Build the application
echo "🚀 Running automated npm build..."
npm run build
echo "✅ Success: npm build completed."

# Initialize the database
 echo "🚀 Re-initializing database..."
 reinit-db.sh
echo "✅ Success: Re-initialization completed."

 # Run tests with verbose output and without watch mode
echo "🚀 Running automated test suite..."
npm run test -- --watch=false
echo "✅ Success: Test suite completed."

 # Start the application (uncomment if you want to start the app after tests)
echo "🚀 Running SAROPs..."
npm run dev
