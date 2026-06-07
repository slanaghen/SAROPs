#!/bin/bash

# SAROps Database Reinitialization Script
# This script concatenates all schema parts and runs them against Supabase

DB_DIR="./db"
COMBINED_SQL="combined_schema.sql"

echo "--- Building combined schema ---"

# Requirement: Verify all source files exist before concatenation to prevent partial schemas
REQUIRED_FILES=(
  "$DB_DIR/00_types.sql"
  "$DB_DIR/01_tables_core.sql"
  "$DB_DIR/02_tables_logistics.sql"
  "$DB_DIR/03_tables_tactical.sql"
  "$DB_DIR/04_indexes.sql"
  "$DB_DIR/05_views.sql"
  "$DB_DIR/06_functions.sql"
  "$DB_DIR/07_triggers.sql"
  "$DB_DIR/08_rls.sql"
  "$DB_DIR/09_rpcs.sql"
  "$DB_DIR/10_seed.sql"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Error: Required SQL file missing: $file"
    exit 1
  fi
done

# Order is critical due to foreign key and type dependencies
cat "${REQUIRED_FILES[@]}" > $COMBINED_SQL

echo "--- Executing reinitialization ---"

# Check if Supabase local services are running
if ! supabase status > /dev/null 2>&1; then
  echo "❌ Error: Supabase local services are not running."
  echo "Please run 'supabase start' and try again."
  exit 1
fi

echo "Connecting to local database via psql..."
if ! command -v psql &> /dev/null; then
  echo "❌ Error: 'psql' client not found. Please run scripts/SAROPs-Install.sh first."
  exit 1
fi

# Execute the script against the local Supabase Postgres container
# -v ON_ERROR_STOP=1 ensures the script stops immediately if any command fails
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f $COMBINED_SQL

rm $COMBINED_SQL
echo "Database reinitialized successfully."