#!/bin/bash
# Database documentation script for migration verification
# Run this BEFORE migrating to AWS

set -e

echo "=========================================="
echo "Database Documentation for AWS Migration"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it using: export DATABASE_URL='your_connection_string'"
    exit 1
fi

OUTPUT_FILE="database-pre-migration-$(date +%Y%m%d-%H%M%S).txt"

echo "Documenting database to: $OUTPUT_FILE"
echo ""

{
    echo "=========================================="
    echo "Database Pre-Migration Documentation"
    echo "Date: $(date)"
    echo "=========================================="
    echo ""

    echo "1. PostgreSQL Version:"
    echo "----------------------"
    psql "$DATABASE_URL" -c "SELECT version();" 2>&1 || echo "Could not retrieve version"
    echo ""

    echo "2. Database Size:"
    echo "----------------"
    psql "$DATABASE_URL" -c "
        SELECT
            pg_size_pretty(pg_database_size(current_database())) as database_size;
    " 2>&1 || echo "Could not retrieve database size"
    echo ""

    echo "3. Table Sizes:"
    echo "--------------"
    psql "$DATABASE_URL" -c "
        SELECT
            schemaname || '.' || tablename as table_name,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    " 2>&1 || echo "Could not retrieve table sizes"
    echo ""

    echo "4. Row Counts:"
    echo "-------------"
    psql "$DATABASE_URL" -c "
        SELECT
            schemaname,
            tablename,
            n_tup_ins - n_tup_del as row_count
        FROM pg_stat_user_tables
        ORDER BY tablename;
    " 2>&1 || echo "Could not retrieve row counts"
    echo ""

    echo "5. Database Schema (Tables):"
    echo "---------------------------"
    psql "$DATABASE_URL" -c "\dt" 2>&1 || echo "Could not retrieve table list"
    echo ""

    echo "6. Prisma Migration History:"
    echo "----------------------------"
    psql "$DATABASE_URL" -c "
        SELECT
            migration_name,
            started_at,
            finished_at,
            applied_steps_count
        FROM _prisma_migrations
        ORDER BY started_at DESC
        LIMIT 10;
    " 2>&1 || echo "Could not retrieve Prisma migration history"
    echo ""

    echo "7. Database Indexes:"
    echo "-------------------"
    psql "$DATABASE_URL" -c "
        SELECT
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
    " 2>&1 || echo "Could not retrieve index information"
    echo ""

    echo "8. Current Connections:"
    echo "----------------------"
    psql "$DATABASE_URL" -c "
        SELECT
            count(*) as active_connections,
            datname as database_name
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY datname;
    " 2>&1 || echo "Could not retrieve connection information"
    echo ""

} > "$OUTPUT_FILE"

echo "✅ Documentation complete!"
echo "File saved to: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Review the output file"
echo "2. Save this file for comparison after AWS migration"
echo "3. Run 'pg_dump' to create a full backup:"
echo "   pg_dump \$DATABASE_URL > database-backup-$(date +%Y%m%d).sql"
echo ""
