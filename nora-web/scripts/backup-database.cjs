// Database backup script using Prisma
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const backupFile = path.join(__dirname, '..', `database-backup-${timestamp}.json`);
  const docFile = path.join(__dirname, '..', `database-documentation-${timestamp}.txt`);

  console.log('Starting database backup and documentation...\n');

  const backup = {
    timestamp: new Date().toISOString(),
    databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
    tables: {}
  };

  const documentation = [];
  documentation.push('==========================================');
  documentation.push('Database Pre-Migration Documentation');
  documentation.push(`Date: ${new Date().toLocaleString()}`);
  documentation.push('==========================================\n');

  try {
    // Get all users
    console.log('Backing up Users...');
    const users = await prisma.user.findMany();
    backup.tables.users = users;
    documentation.push(`Users: ${users.length} records`);

    // Get all sessions
    console.log('Backing up Sessions...');
    const sessions = await prisma.session.findMany();
    backup.tables.sessions = sessions;
    documentation.push(`Sessions: ${sessions.length} records`);

    // Get all refresh tokens
    console.log('Backing up RefreshTokens...');
    const refreshTokens = await prisma.refreshToken.findMany();
    backup.tables.refreshTokens = refreshTokens;
    documentation.push(`RefreshTokens: ${refreshTokens.length} records`);

    // Get all learning progress
    console.log('Backing up LearningProgress...');
    const learningProgress = await prisma.learningProgress.findMany();
    backup.tables.learningProgress = learningProgress;
    documentation.push(`LearningProgress: ${learningProgress.length} records`);

    // Get all module history
    console.log('Backing up ModuleHistory...');
    const moduleHistory = await prisma.moduleHistory.findMany();
    backup.tables.moduleHistory = moduleHistory;
    documentation.push(`ModuleHistory: ${moduleHistory.length} records`);

    // Get all risk audit logs
    console.log('Backing up RiskAuditLog...');
    const riskAuditLog = await prisma.riskAuditLog.findMany();
    backup.tables.riskAuditLog = riskAuditLog;
    documentation.push(`RiskAuditLog: ${riskAuditLog.length} records`);

    // Get all third party requests
    console.log('Backing up ThirdPartyRequest...');
    const thirdPartyRequests = await prisma.thirdPartyRequest.findMany();
    backup.tables.thirdPartyRequests = thirdPartyRequests;
    documentation.push(`ThirdPartyRequest: ${thirdPartyRequests.length} records`);

    // Get all WACB surveys
    console.log('Backing up WacbSurvey...');
    const wacbSurveys = await prisma.wacbSurvey.findMany();
    backup.tables.wacbSurveys = wacbSurveys;
    documentation.push(`WacbSurvey: ${wacbSurveys.length} records`);

    // Calculate total records
    const totalRecords = Object.values(backup.tables).reduce((sum, table) => sum + table.length, 0);
    documentation.push(`\nTotal Records: ${totalRecords}`);

    // Add schema information
    documentation.push('\n==========================================');
    documentation.push('Table Structure Summary');
    documentation.push('==========================================\n');

    if (users.length > 0) {
      documentation.push('User fields: ' + Object.keys(users[0]).join(', '));
    }
    if (sessions.length > 0) {
      documentation.push('Session fields: ' + Object.keys(sessions[0]).join(', '));
    }
    if (learningProgress.length > 0) {
      documentation.push('LearningProgress fields: ' + Object.keys(learningProgress[0]).join(', '));
    }

    // Save backup to JSON file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\n✅ Backup saved to: ${backupFile}`);

    // Save documentation
    fs.writeFileSync(docFile, documentation.join('\n'));
    console.log(`✅ Documentation saved to: ${docFile}`);

    console.log(`\n📊 Summary:`);
    console.log(`   Total tables backed up: ${Object.keys(backup.tables).length}`);
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Backup size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
