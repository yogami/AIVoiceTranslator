#!/usr/bin/env tsx
/**
 * CRITICAL DATABASE INTEGRITY AUDIT
 * 
 * This script compares your schema.ts definitions with the actual database structure
 * to detect any discrepancies that could cause production issues.
 * 
 * Run this script regularly to ensure schema.ts is the single source of truth.
 */

import { db } from '../server/db';
import { sessions, languages, translations, transcripts, users } from '../shared/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

async function getActualTableStructure(tableName: string): Promise<ColumnInfo[]> {
  const result = await db.execute(`
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_name = '${tableName}' 
    ORDER BY ordinal_position
  `);
  return result.rows as ColumnInfo[];
}

function getSchemaTableStructure(table: any) {
  const config = getTableConfig(table);
  return {
    tableName: config.name,
    columns: Object.entries(config.columns).map(([name, col]: [string, any]) => ({
      name,
      type: col.dataType,
      nullable: !col.notNull,
      hasDefault: col.hasDefault,
      defaultValue: col.default
    }))
  };
}

async function auditTable(table: any, tableName: string) {
  console.log(`\n🔍 AUDITING TABLE: ${tableName}`);
  console.log('=' .repeat(50));
  
  const actualColumns = await getActualTableStructure(tableName);
  const schemaConfig = getSchemaTableStructure(table);
  
  console.log('\n📊 Database Columns:');
  actualColumns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
  });
  
  console.log('\n📋 Schema.ts Columns:');
  schemaConfig.columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'} ${col.hasDefault ? 'HAS DEFAULT' : ''}`);
  });
  
  // Check for discrepancies
  const dbColumnNames = new Set(actualColumns.map(c => c.column_name));
  const schemaColumnNames = new Set(schemaConfig.columns.map(c => c.name));
  
  const onlyInDb = [...dbColumnNames].filter(name => !schemaColumnNames.has(name));
  const onlyInSchema = [...schemaColumnNames].filter(name => !dbColumnNames.has(name));
  
  if (onlyInDb.length > 0) {
    console.log('\n❌ CRITICAL: Columns in database but NOT in schema.ts:');
    onlyInDb.forEach(col => console.log(`  - ${col}`));
  }
  
  if (onlyInSchema.length > 0) {
    console.log('\n⚠️  WARNING: Columns in schema.ts but NOT in database:');
    onlyInSchema.forEach(col => console.log(`  - ${col}`));
  }
  
  if (onlyInDb.length === 0 && onlyInSchema.length === 0) {
    console.log('\n✅ Column names match between schema.ts and database');
  }
  
  return {
    tableName,
    columnsMatch: onlyInDb.length === 0 && onlyInSchema.length === 0,
    onlyInDb,
    onlyInSchema
  };
}

interface AuditResult {
  tableName: string;
  columnsMatch: boolean;
  onlyInDb: string[];
  onlyInSchema: string[];
}

async function runAudit() {
  console.log('🚨 DATABASE INTEGRITY AUDIT STARTING...');
  console.log('This will compare schema.ts with actual database structure');
  console.log('=' .repeat(80));
  
  const auditResults: AuditResult[] = [];
  
  // Audit each table
  auditResults.push(await auditTable(users, 'users'));
  auditResults.push(await auditTable(languages, 'languages'));
  auditResults.push(await auditTable(translations, 'translations'));
  auditResults.push(await auditTable(transcripts, 'transcripts'));
  auditResults.push(await auditTable(sessions, 'sessions'));
  
  // Summary
  console.log('\n' + '=' .repeat(80));
  console.log('📋 AUDIT SUMMARY');
  console.log('=' .repeat(80));
  
  const criticalIssues = auditResults.filter(r => r.onlyInDb.length > 0);
  const warnings = auditResults.filter(r => r.onlyInSchema.length > 0);
  const healthy = auditResults.filter(r => r.columnsMatch);
  
  console.log(`✅ Tables with matching schemas: ${healthy.length}`);
  console.log(`⚠️  Tables with missing database columns: ${warnings.length}`);
  console.log(`❌ Tables with untracked database columns: ${criticalIssues.length}`);
  
  if (criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES FOUND!');
    console.log('The following tables have columns in the database that are NOT in schema.ts:');
    criticalIssues.forEach(issue => {
      console.log(`\n  Table: ${issue.tableName}`);
      issue.onlyInDb.forEach(col => console.log(`    - ${col}`));
    });
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Either add these columns to schema.ts');
    console.log('2. Or create migrations to remove them from the database');
    console.log('3. NEVER manually alter database structure again!');
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    console.log('The following schema.ts columns are missing from database:');
    warnings.forEach(warning => {
      console.log(`\n  Table: ${warning.tableName}`);
      warning.onlyInSchema.forEach(col => console.log(`    - ${col}`));
    });
    console.log('\n💡 Run migrations to add these to the database');
  }
  
  if (criticalIssues.length === 0 && warnings.length === 0) {
    console.log('\n🎉 ALL TABLES ARE IN SYNC!');
    console.log('✅ Schema.ts is the accurate source of truth');
    console.log('✅ Database matches schema definitions');
  }
  
  process.exit(criticalIssues.length > 0 ? 1 : 0);
}

runAudit().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
