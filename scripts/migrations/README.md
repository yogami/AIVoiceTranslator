# Database Migrations

This folder contains database migration scripts for the AI Voice Translator application.

## Migration Scripts

### 2025-07-23-add-teacher-id-column.js
- **Purpose**: Adds `teacher_id` column to the `classroom_sessions` table
- **Target**: Railway PostgreSQL database
- **Status**: ✅ Completed on Railway production database
- **Usage**: `node scripts/migrations/2025-07-23-add-teacher-id-column.js`

## Notes

- These scripts are one-time migrations and should only be run when needed
- Always backup your database before running migrations
- Scripts are designed to be idempotent (safe to run multiple times)
- After successful execution, scripts can be kept for historical reference

## Database Environments

- **Development**: Aiven PostgreSQL
- **Testing**: Aiven PostgreSQL (isolated test environment)
- **Production**: Railway PostgreSQL
