const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

// Custom error classes
const {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  UploadError,
  ProcessingError
} = require('./server/utils/errors.cjs');

const app = express();

// Security middleware - allow inline scripts for share page
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "connect-src": ["'self'"]
    }
  }
}));

// CORS configuration - allow any localhost port in development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allowed origins
    const allowedOrigins = [
      'https://hinora.co',
      'https://www.hinora.co',
      'http://localhost:5173',
      'http://localhost:3000'
    ];

    // In production, check against allowed origins
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins (for mobile app, web, etc.)
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Body parser (increase limit for audio file uploads)
// Capture raw body for webhook signature verification
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    if (req.originalUrl.includes('/webhooks/')) {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Email configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const COACH_EMAIL = process.env.COACH_EMAIL;

// Retry helper with exponential backoff
const fetchWithRetry = async (url, options, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Retry on 5xx errors
            if (response.status >= 500 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`API error ${response.status}, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return response;
        } catch (error) {
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Network error, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
};

// Mount auth routes
const authRoutes = require('./server/routes/auth.cjs');
const socialAuthRoutes = require('./server/routes/social-auth.cjs');
app.use('/api/auth', authRoutes);
app.use('/api/auth', socialAuthRoutes);

// Mount session routes
const sessionRoutes = require('./server/routes/sessions.cjs');
app.use('/api/sessions', sessionRoutes);

// Mount learning progress routes (old deck-based system + recommendations)
const learningRoutes = require('./server/routes/learning.cjs');
app.use('/api/learning', learningRoutes);

// Mount lessons routes (bite-size learning curriculum)
const lessonRoutes = require('./server/routes/lessons.cjs');
app.use('/api/lessons', lessonRoutes);

// Mount module routes (module-based browsing)
const moduleRoutes = require('./server/routes/modules.cjs');
app.use('/api/modules', moduleRoutes);

// Mount support routes
const supportRoutes = require('./server/routes/support.cjs');
app.use('/api/support', supportRoutes);
app.use('/api/quizzes', lessonRoutes); // Quiz endpoints are in lessons.cjs
app.use('/api/user', lessonRoutes); // User stats endpoint is in lessons.cjs

// Mount transcription proxy routes (PDPA compliant with anonymization)
const transcriptionProxyRoutes = require('./server/routes/transcription-proxy.cjs');
app.use('/api/transcription', transcriptionProxyRoutes);

// Mount WACB-N survey routes
const wacbSurveyRoutes = require('./server/routes/wacb-survey.cjs');
app.use('/api/wacb-survey', wacbSurveyRoutes);

// Mount PHQ-2 survey routes
const phq2SurveyRoutes = require('./server/routes/phq2-survey.cjs');
app.use('/api/phq2-survey', phq2SurveyRoutes);

// Mount recording upload routes (mobile app)
const recordingRoutes = require('./server/routes/recordings.cjs');
app.use('/api/recordings', recordingRoutes);

// Mount webhook routes (RevenueCat subscription events)
const webhookRoutes = require('./server/routes/webhooks.cjs');
app.use('/api/webhooks', webhookRoutes);

// Mount config routes (authenticated user endpoints)
const configRoutes = require('./server/routes/config.cjs');
app.use('/api/config', configRoutes);

// Mount admin routes
const adminRoutes = require('./server/routes/admin.cjs');
app.use('/api/admin', adminRoutes);

// Serve admin portal build in production
if (process.env.NODE_ENV === 'production') {
  const adminBuildPath = path.join(__dirname, 'admin', 'dist');
  app.use('/admin', express.static(adminBuildPath));
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminBuildPath, 'index.html'));
  });
}

// Send flagged items to coach via email
app.post('/api/send-coach-alert', async (req, res) => {
    try {
        const { flaggedItems, sessionInfo } = req.body;

        // Validate request
        if (!flaggedItems || !Array.isArray(flaggedItems) || flaggedItems.length === 0) {
            return res.status(400).json({ error: 'No flagged items provided' });
        }

        if (!COACH_EMAIL) {
            return res.status(500).json({ error: 'Coach email not configured' });
        }

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            return res.status(500).json({ error: 'Email service not configured' });
        }

        // Format timestamp helper
        const formatTimestamp = (seconds) => {
            if (seconds === null || seconds === undefined) return '--:--';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Build email content
        const flaggedItemsHtml = flaggedItems.map((item, index) => `
            <div style="background: #fff; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="background: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        Timestamp: ${formatTimestamp(item.timestamp)}
                    </span>
                    ${item.speaker !== null ? `<span style="color: #6b7280; font-size: 12px;">Speaker ${item.speaker}</span>` : ''}
                </div>
                <p style="color: #1f2937; font-weight: 500; margin: 0 0 8px 0;">"${item.text}"</p>
                <p style="color: #dc2626; font-size: 12px; font-style: italic; margin: 0;">${item.reason}</p>
            </div>
        `).join('');

        const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">⚠️ PCIT Session Alert</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9;">Negative phrases detected - immediate review required</p>
                </div>
                <div style="background: #fef2f2; padding: 20px; border: 1px solid #fca5a5; border-top: none; border-radius: 0 0 8px 8px;">
                    ${sessionInfo ? `
                        <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                <strong>Session Date:</strong> ${sessionInfo.date || new Date().toLocaleDateString()}<br/>
                                ${sessionInfo.parentName ? `<strong>Parent:</strong> ${sessionInfo.parentName}<br/>` : ''}
                                ${sessionInfo.childName ? `<strong>Child:</strong> ${sessionInfo.childName}` : ''}
                            </p>
                        </div>
                    ` : ''}
                    <h2 style="color: #dc2626; font-size: 16px; margin: 0 0 12px 0;">Flagged Utterances (${flaggedItems.length})</h2>
                    ${flaggedItemsHtml}
                    <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0; text-align: center;">
                        This is an automated alert from the PCIT Coaching App
                    </p>
                </div>
            </div>
        `;

        // Send email
        await emailTransporter.sendMail({
            from: process.env.SMTP_USER,
            to: COACH_EMAIL,
            subject: `⚠️ PCIT Alert: ${flaggedItems.length} Negative Phrase(s) Detected`,
            html: emailHtml
        });

        console.log(`Coach alert email sent to ${COACH_EMAIL} with ${flaggedItems.length} flagged items`);
        res.json({ success: true, message: 'Alert sent to coach' });

    } catch (error) {
        console.error('Send coach alert error:', error.message, error.stack);
        res.status(500).json({
            error: 'Failed to send coach alert',
            details: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        services: {
            anthropic: !!ANTHROPIC_API_KEY,
            email: !!(process.env.SMTP_USER && COACH_EMAIL)
        }
    });
});

// ============================================
// GLOBAL ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler - must come before error handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Global error handler - must be last middleware
app.use((err, req, res, next) => {
  // Log error with full context
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
    statusCode: err.statusCode || 500,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // TODO Phase 3: Send to Sentry (error monitoring)
  // if (process.env.SENTRY_DSN && (!err.statusCode || err.statusCode >= 500)) {
  //   Sentry.captureException(err, {
  //     user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
  //     tags: { path: req.path, method: req.method, errorCode: err.code }
  //   });
  // }

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Build error response
  const errorResponse = {
    error: err.userMessage || 'An unexpected error occurred',
    code: err.code || 'INTERNAL_ERROR'
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }

  // Add validation details if present
  if (err.details) {
    errorResponse.validationErrors = err.details;
  }

  res.status(statusCode).json(errorResponse);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
