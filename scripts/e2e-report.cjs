#!/usr/bin/env node
/**
 * End-to-End Report Generation Script
 *
 * Runs the full pipeline from an audio file to a completed session report
 * for a given user. Optionally generates the weekly report as well.
 *
 * Usage:
 *   # From a local audio file (creates a new session):
 *   node scripts/e2e-report.cjs --user <userId> --audio <path/to/audio.m4a>
 *
 *   # From an existing session (re-runs analysis from current state):
 *   node scripts/e2e-report.cjs --session <sessionId>
 *
 *   # Resume from an existing session, skipping transcription (already done):
 *   node scripts/e2e-report.cjs --session <sessionId> --skip-transcription
 *
 *   # Full pipeline + generate weekly report:
 *   node scripts/e2e-report.cjs --user <userId> --audio <path> --weekly-report
 *
 * Options:
 *   --user <id>              User ID (required when --audio is provided)
 *   --audio <path>           Path to local audio file to upload and process
 *   --session <id>           Existing session ID to re-process
 *   --mode CDI|PDI           Session mode (default: CDI, only used when creating a session)
 *   --duration <seconds>     Audio duration in seconds (auto-detected if ffprobe is available)
 *   --skip-transcription     Skip transcription step (assumes utterances already exist)
 *   --skip-analysis          Skip PCIT analysis step (only transcribe)
 *   --weekly-report          Also generate/update the weekly report after analysis
 *   --dry-run                Print resolved config and exit without processing
 */

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

// ─── Parse CLI arguments ────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

const userId          = getArg('--user');
const audioPath       = getArg('--audio');
const sessionId       = getArg('--session');
const mode            = (getArg('--mode') || 'CDI').toUpperCase();
const durationArg     = getArg('--duration');
const skipTranscribe  = hasFlag('--skip-transcription');
const skipAnalysis    = hasFlag('--skip-analysis');
const runWeeklyReport = hasFlag('--weekly-report');
const dryRun          = hasFlag('--dry-run');
const help            = hasFlag('--help') || hasFlag('-h');

// ─── Help ────────────────────────────────────────────────────────────────────

if (help || args.length === 0) {
  console.log(`
Usage:
  node scripts/e2e-report.cjs [options]

Modes:
  --user <id> --audio <path>    Upload audio and run full pipeline for user
  --session <id>                Re-process an existing session

Options:
  --mode CDI|PDI           Session mode (default: CDI)
  --duration <seconds>     Audio duration in seconds
  --skip-transcription     Skip transcription (utterances must already exist)
  --skip-analysis          Only transcribe, skip PCIT analysis
  --weekly-report          Also generate weekly report after analysis
  --dry-run                Show resolved config and exit
  --help                   Show this help message
`);
  process.exit(0);
}

// ─── Validate arguments ──────────────────────────────────────────────────────

if (!sessionId && !userId) {
  console.error('❌  Must provide either --session <id> or --user <id>');
  process.exit(1);
}

if (!sessionId && userId && !audioPath) {
  console.error('❌  --audio <path> is required when providing --user to create a new session');
  process.exit(1);
}

if (audioPath && !fs.existsSync(audioPath)) {
  console.error(`❌  Audio file not found: ${audioPath}`);
  process.exit(1);
}

if (mode !== 'CDI' && mode !== 'PDI') {
  console.error('❌  --mode must be CDI or PDI');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sep = () => console.log('\n' + '─'.repeat(72));

function log(emoji, label, msg = '') {
  console.log(`${emoji}  [${label}] ${msg}`);
}

/**
 * Try to detect duration from an audio file using ffprobe.
 * Falls back to a provided --duration value or throws.
 */
function detectDuration(filePath, fallback) {
  try {
    const raw = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim();
    const secs = Math.ceil(parseFloat(raw));
    if (!isNaN(secs) && secs > 0) return secs;
  } catch (_) {
    // ffprobe not available
  }
  if (fallback) return parseInt(fallback, 10);
  throw new Error(
    'Could not detect audio duration. Install ffprobe or pass --duration <seconds>'
  );
}

/**
 * Derive MIME type from file extension.
 */
function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const map = {
    m4a: 'audio/x-m4a',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    aac: 'audio/aac',
    mp4: 'audio/mp4',
  };
  return map[ext] || 'audio/m4a';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  try {
    // ── Resolve session ──────────────────────────────────────────────────────

    let resolvedSessionId = sessionId;
    let resolvedUserId    = userId;
    let storagePath;
    let durationSeconds;

    if (sessionId) {
      // Load existing session
      log('🔍', 'SESSION', `Looking up session ${sessionId.substring(0, 8)}…`);
      const existing = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { User: { select: { id: true, email: true, childName: true } } }
      });
      if (!existing) {
        console.error(`❌  Session not found: ${sessionId}`);
        process.exit(1);
      }
      resolvedUserId  = existing.userId;
      storagePath     = existing.storagePath;
      durationSeconds = existing.durationSeconds;
      log('✅', 'SESSION', `Found: mode=${existing.mode}, status=${existing.analysisStatus}, user=${existing.User?.email}`);
    }

    // ── Resolve user ─────────────────────────────────────────────────────────

    log('🔍', 'USER', `Looking up user ${resolvedUserId.substring(0, 8)}…`);
    const user = await prisma.user.findUnique({
      where: { id: resolvedUserId },
      select: { id: true, email: true, childName: true }
    });
    if (!user) {
      console.error(`❌  User not found: ${resolvedUserId}`);
      process.exit(1);
    }
    log('✅', 'USER', `Found: ${user.email}`);

    // ── Upload audio & create session (when --audio is provided) ─────────────

    if (audioPath) {
      durationSeconds = detectDuration(audioPath, durationArg);
      const mimeType  = mimeFromPath(audioPath);
      const newId     = crypto.randomUUID();
      resolvedSessionId = newId;

      if (dryRun) {
        sep();
        console.log('DRY-RUN config:');
        console.log({
          resolvedSessionId,
          resolvedUserId,
          audioPath,
          mimeType,
          durationSeconds,
          mode,
          skipTranscribe,
          skipAnalysis,
          runWeeklyReport,
        });
        return;
      }

      // Upload to S3
      sep();
      log('📤', 'UPLOAD', `Reading ${path.basename(audioPath)} (${(fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)} MB)…`);
      const audioBuffer = fs.readFileSync(audioPath);

      const storage = require('../server/services/storage-s3.cjs');
      storagePath = await storage.uploadAudioFile(audioBuffer, resolvedUserId, newId, mimeType);
      log('✅', 'UPLOAD', `Stored at: ${storagePath}`);

      // Create session record
      log('💾', 'DB', 'Creating session record…');
      await prisma.session.create({
        data: {
          id:             newId,
          userId:         resolvedUserId,
          mode:           mode,
          storagePath:    storagePath,
          durationSeconds: durationSeconds,
          transcript:     '',
          aiFeedbackJSON: {},
          pcitCoding:     {},
          tagCounts:      {},
          masteryAchieved: false,
          riskScore:      0,
          flaggedForReview: false,
          analysisStatus: 'PENDING',
        }
      });
      log('✅', 'DB', `Session created: ${newId}`);
    } else if (dryRun) {
      sep();
      console.log('DRY-RUN config:');
      console.log({
        resolvedSessionId,
        resolvedUserId,
        storagePath,
        durationSeconds,
        skipTranscribe,
        skipAnalysis,
        runWeeklyReport,
      });
      return;
    }

    // ── Transcription ─────────────────────────────────────────────────────────

    if (!skipTranscribe) {
      sep();
      log('🎤', 'TRANSCRIBE', `Starting transcription (mode: ${process.env.TRANSCRIPTION_MODE || 'v2'})…`);

      const { transcribeRecording } = require('../server/services/transcriptionService.cjs');
      const { transcript, utterances } = await transcribeRecording(
        resolvedSessionId,
        resolvedUserId,
        storagePath,
        durationSeconds
      );

      log('✅', 'TRANSCRIBE', `Done — ${utterances.length} utterances`);
      console.log('\n--- Transcript preview (first 300 chars) ---');
      console.log(transcript.substring(0, 300) + (transcript.length > 300 ? '…' : ''));
    } else {
      log('⏭ ', 'TRANSCRIBE', 'Skipped (--skip-transcription)');
    }

    // ── PCIT Analysis ─────────────────────────────────────────────────────────

    if (!skipAnalysis) {
      sep();
      log('🧠', 'ANALYSIS', `Starting PCIT analysis (AI provider: ${process.env.AI_PROVIDER || 'gemini-flash'})…`);

      // Mark as PROCESSING
      await prisma.session.update({
        where: { id: resolvedSessionId },
        data:  { analysisStatus: 'PROCESSING' }
      });

      const { processRecordingWithRetry, notifyProcessingFailure } = require('../server/services/processingService.cjs');

      try {
        await processRecordingWithRetry(resolvedSessionId, resolvedUserId, 0);
        log('✅', 'ANALYSIS', 'Completed successfully');
      } catch (analysisErr) {
        log('❌', 'ANALYSIS', `Failed after retries: ${analysisErr.message}`);
        await notifyProcessingFailure(resolvedSessionId, resolvedUserId, analysisErr);
        throw analysisErr;
      }
    } else {
      log('⏭ ', 'ANALYSIS', 'Skipped (--skip-analysis)');
    }

    // ── Session summary ───────────────────────────────────────────────────────

    sep();
    const finalSession = await prisma.session.findUnique({
      where: { id: resolvedSessionId },
      select: {
        id:             true,
        mode:           true,
        analysisStatus: true,
        overallScore:   true,
        tagCounts:      true,
        durationSeconds: true,
        createdAt:      true,
        coachingSummary: true,
      }
    });

    log('📊', 'RESULT', 'Session summary:');
    console.log(JSON.stringify({
      sessionId:      finalSession.id,
      mode:           finalSession.mode,
      status:         finalSession.analysisStatus,
      overallScore:   finalSession.overallScore,
      durationSeconds: finalSession.durationSeconds,
      tagCounts:      finalSession.tagCounts,
      createdAt:      finalSession.createdAt,
    }, null, 2));

    if (finalSession.coachingSummary) {
      console.log('\n--- Coaching Summary ---');
      console.log(finalSession.coachingSummary.substring(0, 400) + '…');
    }

    // ── Weekly Report ─────────────────────────────────────────────────────────

    if (runWeeklyReport) {
      sep();
      log('📅', 'WEEKLY-REPORT', 'Generating weekly report…');

      const { generateWeeklyReport } = require('../server/services/weeklyReportService.cjs');

      // Use the start of the session's creation week (Monday)
      const sessionDate  = new Date(finalSession.createdAt);
      const dayOfWeek    = sessionDate.getDay(); // 0=Sun
      const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
      const weekStart    = new Date(sessionDate);
      weekStart.setDate(sessionDate.getDate() + daysToMonday);
      weekStart.setHours(0, 0, 0, 0);

      log('📅', 'WEEKLY-REPORT', `Week starting: ${weekStart.toISOString().split('T')[0]}`);

      const report = await generateWeeklyReport(resolvedUserId, weekStart);

      if (report) {
        log('✅', 'WEEKLY-REPORT', `Report generated: ${report.id}`);
        console.log(JSON.stringify({
          reportId:        report.id,
          weekStart:       report.weekStartDate,
          weekEnd:         report.weekEndDate,
          sessionCount:    report.sessionCount,
          avgNoraScore:    report.avgNoraScore,
          totalDeposits:   report.totalDeposits,
          praiseCount:     report.praiseCount,
          echoCount:       report.echoCount,
          narrateCount:    report.narrateCount,
          generatedAt:     report.generatedAt,
        }, null, 2));
      } else {
        log('⚠️ ', 'WEEKLY-REPORT', 'No completed sessions found for this week — report not generated');
      }
    }

    sep();
    log('🎉', 'DONE', `Pipeline complete for session ${resolvedSessionId}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
