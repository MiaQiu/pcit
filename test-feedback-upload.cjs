/**
 * Test script to upload audio and test feedback feature
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// AWS Configuration
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'nora-audio-059364397483-sg';
const s3Client = new S3Client({ region: AWS_REGION });

async function uploadAndAnalyze() {
  try {
    console.log('🎬 Starting test upload and analysis...\n');

    // Get a test user
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No users found in database. Please create a user first.');
    }
    console.log(`✅ Found user: ${user.id}\n`);

    // Read audio file
    const audioPath = '/Users/mia/Downloads/audio3_panhu_baba_mama.m4a';
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const audioBuffer = fs.readFileSync(audioPath);
    const audioStats = fs.statSync(audioPath);
    console.log(`✅ Read audio file: ${(audioStats.size / 1024 / 1024).toFixed(2)} MB\n`);

    // Upload to S3
    const sessionId = uuidv4();
    const s3Key = `recordings/${user.id}/${sessionId}.m4a`;

    console.log('📤 Uploading to S3...');
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: 'audio/m4a'
    }));
    console.log(`✅ Uploaded to S3: ${s3Key}\n`);

    // Create session in database
    console.log('💾 Creating session record...');
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        mode: 'CDI',
        storagePath: s3Key,
        durationSeconds: 60, // Estimate
        transcript: '',
        aiFeedbackJSON: {},
        pcitCoding: {},
        tagCounts: {},
        masteryAchieved: false,
        riskScore: 0,
        flaggedForReview: false,
        analysisStatus: 'PENDING'
      }
    });
    console.log(`✅ Created session: ${session.id}\n`);

    console.log('🎉 Upload complete! Session created.');
    console.log(`📝 Session ID: ${session.id}`);
    console.log(`\nThe background analysis job will process this recording.`);
    console.log(`You can monitor progress with:\n`);
    console.log(`  node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.session.findUnique({where:{id:'${session.id}'},select:{analysisStatus:true}}).then(r=>console.log(r)).finally(()=>p.\\$disconnect());"`);
    console.log(`\nOr check utterances with feedback:\n`);
    console.log(`  node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.utterance.findMany({where:{sessionId:'${session.id}'},select:{text:true,feedback:true,noraTag:true},take:5}).then(r=>console.log(JSON.stringify(r,null,2))).finally(()=>p.\\$disconnect());"`);

    return session.id;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

uploadAndAnalyze();
