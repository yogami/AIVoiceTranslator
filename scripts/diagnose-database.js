#!/usr/bin/env node

/**
 * Database Diagnostic Script
 * 
 * This script helps diagnose database connection and data storage issues
 * by checking different environment configurations and database contents.
 */

import { config } from '../server/config.js';
import { DatabaseStorage } from '../server/database-storage.js';

async function main() {
  console.log('🔍 AI Voice Translator Database Diagnostic\n');

  // Check environment configuration
  console.log('📋 Environment Configuration:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : 'undefined'}`);
  console.log(`PORT: ${process.env.PORT || 'undefined'}`);
  console.log(`HOST: ${process.env.HOST || 'undefined'}\n`);

  try {
    // Initialize database storage
    const storage = new DatabaseStorage();
    console.log('✅ Database storage initialized successfully');

    // Test database connection
    console.log('\n🔗 Testing Database Connection...');
    
    // Check sessions
    console.log('\n📊 Session Data Analysis:');
    const allSessions = await storage.getAllSessions();
    console.log(`Total sessions in database: ${allSessions.length}`);
    
    if (allSessions.length > 0) {
      const activeSessions = allSessions.filter(s => s.isActive);
      const recentSessions = allSessions.filter(s => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return s.startTime && new Date(s.startTime) > oneDayAgo;
      });
      
      console.log(`Active sessions: ${activeSessions.length}`);
      console.log(`Sessions created in last 24 hours: ${recentSessions.length}`);
      
      // Show recent sessions details
      console.log('\n📝 Recent Sessions Details:');
      const lastFiveSessions = allSessions
        .sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0))
        .slice(0, 5);
      
      lastFiveSessions.forEach((session, index) => {
        console.log(`${index + 1}. Session ID: ${session.sessionId}`);
        console.log(`   Created: ${session.startTime || 'Unknown'}`);
        console.log(`   Active: ${session.isActive}`);
        console.log(`   Students: ${session.studentsCount || 0}`);
        console.log(`   Translations: ${session.totalTranslations || 0}`);
        console.log(`   Class Code: ${session.classCode || 'None'}`);
        console.log(`   Teacher Language: ${session.teacherLanguage || 'None'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No sessions found in database');
    }

    // Check translations
    console.log('\n🌐 Translation Data Analysis:');
    const allTranslations = await storage.getTranslations(100);
    console.log(`Total translations in database: ${allTranslations.length}`);
    
    if (allTranslations.length > 0) {
      const recentTranslations = allTranslations.filter(t => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return t.timestamp && new Date(t.timestamp) > oneDayAgo;
      });
      
      console.log(`Translations in last 24 hours: ${recentTranslations.length}`);
      
      // Show recent translations
      console.log('\n📝 Recent Translations:');
      const lastFiveTranslations = allTranslations
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, 5);
      
      lastFiveTranslations.forEach((translation, index) => {
        console.log(`${index + 1}. ${translation.sourceLanguage} → ${translation.targetLanguage}`);
        console.log(`   Original: "${translation.originalText}"`);
        console.log(`   Translated: "${translation.translatedText}"`);
        console.log(`   Session: ${translation.sessionId || 'None'}`);
        console.log(`   Time: ${translation.timestamp || 'Unknown'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No translations found in database');
    }

    // Test analytics functionality
    console.log('\n📈 Analytics System Test:');
    try {
      const sessionMetrics = await storage.getSessionMetrics();
      console.log(`Session metrics retrieved successfully:`);
      console.log(`  Total sessions: ${sessionMetrics.totalSessions}`);
      console.log(`  Active sessions: ${sessionMetrics.activeSessions}`);
      console.log(`  Sessions last 24h: ${sessionMetrics.sessionsLast24Hours}`);
      console.log(`  Average duration: ${Math.round(sessionMetrics.averageSessionDuration / 60)} minutes`);
    } catch (error) {
      console.error('❌ Analytics metrics error:', error.message);
    }

    // Check for configuration issues
    console.log('\n🔧 Configuration Analysis:');
    
    // Check if environment is properly set for production
    if (process.env.NODE_ENV === 'production') {
      console.log('✅ Running in production mode');
      if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL not set in production environment');
      } else if (process.env.DATABASE_URL.includes('localhost')) {
        console.log('⚠️  DATABASE_URL points to localhost in production');
      } else {
        console.log('✅ DATABASE_URL configured for production');
      }
    } else {
      console.log(`⚠️  Not running in production mode (NODE_ENV: ${process.env.NODE_ENV})`);
    }

    console.log('\n🎯 Recommendations:');
    
    if (allSessions.length === 0) {
      console.log('1. No sessions found - check if sessions are being created when teachers start sessions');
      console.log('2. Verify WebSocket server is properly saving sessions to database');
      console.log('3. Check server logs for database connection errors');
    }
    
    if (allTranslations.length === 0) {
      console.log('1. No translations found - check if translation storage is working');
      console.log('2. Verify TranslationOrchestrator is calling storage.addTranslation()');
      console.log('3. Check for database schema issues with translations table');
    }
    
    console.log('4. Test the analytics page with a direct database query');
    console.log('5. Check production environment variables in Railway dashboard');

  } catch (error) {
    console.error('❌ Database diagnostic failed:', error);
    console.error('\nPossible issues:');
    console.error('1. Database connection string is incorrect');
    console.error('2. Database is not accessible from current environment');
    console.error('3. Database schema is not properly initialized');
    console.error('4. Environment variables are not loaded correctly');
  }
}

main().catch(console.error);
