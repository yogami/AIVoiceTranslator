# Database Schema Management Rules

## 🚨 CRITICAL: Schema.ts is the ONLY Source of Truth

### ✅ Correct Process for Database Changes

1. **Modify** `shared/schema.ts` ONLY
2. **Generate Migration**: `npm run db:migrations:generate`
3. **Review** the generated migration file in `migrations/`
4. **Apply to Test**: `npm run db:migrations:apply:test`
5. **Test** your changes
6. **Apply to Production**: `npm run db:migrations:apply`
7. **Audit**: `npm run db:audit` to verify

### ❌ NEVER DO THIS

- ✖️ Write raw SQL for schema changes
- ✖️ Use `ALTER TABLE`, `ADD COLUMN`, etc. manually
- ✖️ Trust anyone (including AI) to "quickly fix" schema issues
- ✖️ Skip migration generation
- ✖️ Directly modify production database

### 🔍 Safety Checks

Before any deployment:
```bash
npm run db:audit        # Must pass
npm run db:audit:test   # Must pass
```

### 🚨 If Schema Drift is Detected

1. **STOP** all deployments
2. **Audit** with `npm run db:audit`
3. **Either**: Add missing columns to `schema.ts` + generate migration
4. **Or**: Create migration to remove extra database columns
5. **Never** manually sync databases

### 📋 Regular Health Checks

Run weekly:
```bash
npm run db:audit
npm run db:audit:test
```

Both should show: "🎉 ALL TABLES ARE IN SYNC!"

## Recovery Process

If schema drift is detected:

1. **Identify** differences with audit script
2. **Decide**: Should extra DB columns be in schema.ts?
3. **If Yes**: Add to schema.ts + generate migration
4. **If No**: Create migration to remove them
5. **Apply** migrations properly
6. **Re-audit** to confirm sync

## Emergency Contacts

If production is broken due to schema issues:
1. Immediately rollback to last known good state
2. Fix schema.ts to match production
3. Generate proper migrations
4. Test thoroughly before re-deploying
