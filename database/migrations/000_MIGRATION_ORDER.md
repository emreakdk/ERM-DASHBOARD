# Database Migration Order

This document describes the correct order to run database migrations for the ERM Dashboard SaaS application.

## Migration Files (Run in Order)

1. **001_subscription_system.sql**
   - Creates subscription plans table
   - Sets up RLS policies for plans
   - Creates default subscription plans (Free, Starter, Professional, Enterprise)
   - Adds plan_id column to companies table

2. **002_enforce_company_plans.sql**
   - Makes plan_id required on companies table
   - Assigns default plan to existing companies
   - Creates quota check functions and triggers
   - Sets up usage tracking

3. **003_system_errors_table.sql**
   - Creates system_errors table for centralized error logging
   - Sets up RLS policies for error access
   - Creates indexes for performance

## How to Run Migrations

### Using Supabase CLI
```bash
# Run all migrations in order
supabase db reset

# Or run individually
psql -h <your-db-host> -U postgres -d postgres -f database/migrations/001_subscription_system.sql
psql -h <your-db-host> -U postgres -d postgres -f database/migrations/002_enforce_company_plans.sql
psql -h <your-db-host> -U postgres -d postgres -f database/migrations/003_system_errors_table.sql
```

### Using Supabase Dashboard
1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste each migration file content
3. Run them in order (001 → 002 → 003)

## Important Notes

- **DO NOT** skip migrations or run them out of order
- Each migration is idempotent (safe to run multiple times)
- Migrations include DROP IF EXISTS statements for safety
- Always backup your database before running migrations in production

## Rollback

If you need to rollback migrations, you can:
1. Restore from database backup
2. Manually drop created tables/functions (not recommended for production)

## Verification

After running migrations, verify:
```sql
-- Check subscription plans exist
SELECT * FROM subscription_plans;

-- Check companies have plans
SELECT id, name, plan_id FROM companies WHERE plan_id IS NULL;

-- Check system_errors table exists
SELECT COUNT(*) FROM system_errors;
```
