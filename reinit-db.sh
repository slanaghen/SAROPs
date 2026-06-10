#!/bin/bash

# SAROps Database Reinitialization Script
# This script concatenates all schema parts and runs them against Supabase

DB_DIR="./db"
COMBINED_SQL="combined_schema.sql"

# Connection Configuration
# Defaults to local development. To target remote, set these environment variables:
# Export them in your shell or pass them directly: DB_HOST=... DB_PORT=... DB_PASS=... ./reinit-db.sh

if [ $# -eq 0 ]; then
  # Local defaults
  echo "Running local DB"
  DB_HOST=${DB_HOST:-"127.0.0.1"}
  DB_PORT=${DB_PORT:-"54322"}
  DB_PASS=${DB_PASS:-"postgres"}
else
  echo "Running remote DB"
  # Remote defaults: host=db.[project-ref].supabase.co, port=5432
  DB_HOST="db.drwhmrtmtavsonprlwkq.supabase.co" 
  DB_PORT="5432" 
  DB_PASS=[PWD?] 
fi

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
  "$DB_DIR/seed-data-specific.sql"
  "$DB_DIR/99_clear_data.sql"
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

# Check local status only if targeting the local instance
if [ "$DB_HOST" = "127.0.0.1" ]; then
  if ! supabase status > /dev/null 2>&1; then
    echo "❌ Error: Supabase local services are not running."
    echo "Please run 'supabase start' and try again."
    exit 1
  fi
fi

echo "Connecting to database at $DB_HOST:$DB_PORT via psql..."
if ! command -v psql &> /dev/null; then
  echo "❌ Error: 'psql' client not found. Please run scripts/SAROPs-Install.sh first."
  exit 1
fi

# Execute the combined script against the target database
# -v ON_ERROR_STOP=1 ensures the script stops immediately if any command fails
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -f $COMBINED_SQL

rm $COMBINED_SQL
echo "Database reinitialized successfully."
