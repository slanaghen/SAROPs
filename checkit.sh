#!/usr/bin/env bash

ENV_FILE=".env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: $ENV_FILE not found"
    exit 1
fi

# Read .env file
while IFS='=' read -r var value; do
    # Skip comments and blank lines
    [[ -z "$var" || "$var" =~ ^[[:space:]]*# ]] && continue
    [[ "$var" = "SAROPS_DB_INSTANCE" || \
       "$var" = "DB_REMOTE_HOST"  || \
       "$var" = "DB_REMOTE_PORT"  || \
       "$var" = "SUPABASE_PORT"  || \
       "$var" = "VITE_LOCAL_SUPABASE_URL"  || \
       "$var" = "DB_LOCAL_PASS"  || \
       "$var" = "DB_LOCAL_HOST"  || \
       "$var" = "DB_LOCAL_PORT" ]] && continue

    # Trim whitespace
    var=$(echo "$var" | xargs)
    value=$(echo "$value" | sed 's/^ *//;s/ *$//')

    # Remove surrounding quotes
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"

    # Skip empty values
    [[ -z "$value" ]] && continue

    # Search all files except .env
    grep -RInF --exclude="$(basename "$ENV_FILE")" --exclude-dir=dist -- "$value" . 2>/dev/null |
    while IFS=: read -r file line _; do
        echo "$var,$value:$file,$line"
    done

done < "$ENV_FILE"
