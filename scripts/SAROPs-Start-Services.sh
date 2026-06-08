#!/bin/bash

# SAROps Services Startup Script
# Ensures Docker is running and Supabase local stack is started.

echo "--- Checking System Dependencies ---"

# 1. Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "🐳 Docker daemon is not detected."

  # Attempt to start Docker on macOS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Attempting to launch Docker Desktop..."
    open -a Docker
  
  # Wait for Docker to initialize
    COUNT=0
    MAX_RETRIES=24 # Wait up to 2 minutes
    while ! docker info > /dev/null 2>&1; do
      if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Timeout: Docker failed to start in time."
        exit 1
      fi
      echo "Waiting for Docker to initialize... ($((COUNT*5))s)"
      sleep 5
      COUNT=$((COUNT+1))
    done
  else
    echo "❌ Please start the Docker daemon manually on your system."
    exit 1
  fi
fi

echo "✅ Docker is running."

# 2. Check Supabase Status
if ! supabase status > /dev/null 2>&1; then
  echo "⚡ Supabase local services are stopped. Starting now..."
  supabase start
else
  echo "✅ Supabase local services are already active."
fi

echo ""
echo "--- Startup Complete ---"
# Display the local service URLs and credentials
supabase status
