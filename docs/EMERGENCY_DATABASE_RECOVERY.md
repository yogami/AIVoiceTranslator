# 🆘 Database Emergency Recovery Guide

## 🚨 If Production Database is Broken

### Step 1: STOP Everything
```bash
# Stop all deployments and services immediately
# Don't make any more changes until you understand what happened
```

### Step 2: Assess the Damage
```bash
# Check what's wrong
npm run db:audit        # Production
npm run db:audit:test   # Test (should be working)
```

### Step 3: Emergency Recovery Options

#### Option A: Your Test/Dev Database is Working ✅
```bash
# Copy structure from working test database to production
npm run db:emergency:introspect:test    # Get schema from test DB
npm run db:emergency:push               # Apply to production

# Verify fix
npm run db:audit
```

#### Option B: Schema.ts is Correct, Database is Wrong
```bash
# Force push schema.ts to production database
npm run db:emergency:push

# Verify fix  
npm run db:audit
```

#### Option C: Nuclear Option - Export/Import DDL
```bash
# Export schema from working database
pg_dump --schema-only --no-owner --no-privileges $TEST_DATABASE_URL > emergency_schema.sql

# Apply to broken production (WILL LOSE DATA!)
psql $PRODUCTION_DATABASE_URL < emergency_schema.sql

# Clean up
rm emergency_schema.sql
```

### Step 4: Verify Recovery
```bash
# Both should pass
npm run db:audit
npm run db:audit:test
```

### Step 5: Post-Recovery Actions

1. **Update schema.ts** to match production reality
2. **Generate migration** for any missing changes: `npm run db:migrations:generate`  
3. **Document what happened** and how to prevent it
4. **Set up automated audits** in CI/CD pipeline

## 🔒 Prevention

- **Always audit before changes:** `npm run db:audit`
- **Never bypass schema.ts**
- **Never use raw SQL for structure changes**
- **Regular health checks:** Weekly `npm run db:audit`
- **Use CI/CD checks:** Add `./scripts/ci-db-check.sh` to pipeline

## 📞 Emergency Contacts

If you're completely stuck:
1. Rollback to last known good deployment
2. Fix schema.ts to match current production state
3. Generate migrations for any needed changes
4. Test thoroughly before re-deploying
