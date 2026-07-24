#!/bin/bash

# SAROps Database Reinitialization Script
# This script concatenates all schema parts and runs them against Supabase

DB_DIR="./db"
COMBINED_SQL="combined_schema.sql"
source .env

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
  "$DB_DIR/11_admin_rpcs.sql"
  "$DB_DIR/seed-data-specific.sql"
  "$DB_DIR/99_clear_data.sql"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Error: Required SQL file missing: $file"
    exit 1
  fi
done

# Order is critical due to foreign key and type dependencies
cat "${REQUIRED_FILES[@]}" > $COMBINED_SQL

echo "--- Executing ${SAROPS_DB_INSTANCE} reinitialization ---"

if [ "$SAROPS_DB_INSTANCE" = "LOCAL" ]; then
  # Check if Supabase local services are running
  if ! supabase status > /dev/null 2>&1; then
    echo "❌ Error: Supabase local services are not running."
    echo "Please run 'supabase start' and try again."
    rm $COMBINED_SQL
    exit 1
  fi

  echo "Connecting to local database via psql (port ${DB_LOCAL_PORT:-54322})..."

  if ! command -v psql &> /dev/null; then
    echo "❌ Error: 'psql' client not found. Please run scripts/SAROPs-Install.sh first."
    rm $COMBINED_SQL
    exit 1
  fi

  if ! PGPASSWORD=postgres psql -h 127.0.0.1 -p ${DB_LOCAL_PORT:-54322} -U postgres -d postgres -v ON_ERROR_STOP=1 -f $COMBINED_SQL; then
    echo "❌ Error: Failed to execute query on local database. Ensure port ${DB_LOCAL_PORT:-54322} is correct and 'supabase start' has finished."
    rm $COMBINED_SQL
    exit 1
  fi
  rm $COMBINED_SQL
  # Notify PostgREST to reload schema after local DB changes
  PGPASSWORD=postgres psql -h 127.0.0.1 -p ${DB_LOCAL_PORT:-54322} -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
else
  if ! supabase sql query --project-ref $SUPABASE_PROJECT_ID --file "$COMBINED_SQL" >/dev/null 2>&1; then
    echo "❌ Error: Failed to execute query on remote database."
    exit 1
  fi
  # Notify PostgREST to reload schema after remote DB changes
  # Note: The project-ref needs to be passed again for the NOTIFY command.
  #supabase sql query --project-ref $SUPABASE_PROJECT_ID "NOTIFY pgrst, 'reload schema';"
fi
echo "✅ ${SAROPS_DB_INSTANCE} Database reinitialized successfully."
