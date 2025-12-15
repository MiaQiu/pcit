// Support request routes
const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');
const { uploadSupportAttachment } = require('../services/storage-s3.cjs');

const router = express.Router();

// Configure multer for memory storage (support attachments)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5 // Max 5 files
  }
});

// Validation schema
const supportRequestSchema = Joi.object({
  email: Joi.string().email().required(),
  description: Joi.string().min(10).max(5000).required()
});

// POST /api/support/request
// Submit a support request with optional file attachments
router.post('/request',
  require('../middleware/auth.cjs').requireAuth,
  upload.array('attachments', 5),
  async (req, res) => {
    try {
      // Validate input
      const { error, value } = supportRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const { email, description } = value;
      const userId = req.userId;

      // Generate unique request ID
      const requestId = crypto.randomUUID();

      // Debug: Log what we received
      console.log('Support request received:');
      console.log('- User ID:', userId);
      console.log('- Email:', email);
      console.log('- Description:', description.substring(0, 50) + '...');
      console.log('- Files received:', req.files ? req.files.length : 0);
      console.log('- Request body keys:', Object.keys(req.body));
      console.log('- Request files:', req.files);

      // Upload attachments to S3 if any
      const attachmentUrls = [];
      if (req.files && req.files.length > 0) {
        console.log(`Processing ${req.files.length} file(s)...`);
        for (const file of req.files) {
          try {
            const attachmentData = await uploadSupportAttachment(
              file.buffer,
              userId,
              requestId,
              file.originalname,
              file.mimetype
            );
            attachmentUrls.push(attachmentData);
          } catch (uploadError) {
            console.error('Failed to upload attachment:', uploadError);
            // Continue with other files even if one fails
          }
        }
      }

      // Create support request in database
      const supportRequest = await prisma.supportRequest.create({
        data: {
          id: requestId,
          userId,
          email,
          description,
          attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
          status: 'OPEN',
          priority: 'MEDIUM'
        }
      });

      console.log(`Support request created: ${requestId} for user ${userId}`);
      console.log(`Attachments saved: ${attachmentUrls.length}`);

      res.status(201).json({
        success: true,
        requestId: supportRequest.id,
        message: 'Support request submitted successfully'
      });
    } catch (err) {
      console.error('Support request error:', err);
      res.status(500).json({ error: 'Failed to submit support request' });
    }
  }
);

// GET /api/support/requests
// Get all support requests for the current user
router.get('/requests', require('../middleware/auth.cjs').requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const requests = await prisma.supportRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        attachments: true
      }
    });

    res.json({ requests });
  } catch (err) {
    console.error('Get support requests error:', err);
    res.status(500).json({ error: 'Failed to retrieve support requests' });
  }
});

// GET /api/support/request/:requestId
// Get a specific support request
router.get('/request/:requestId', require('../middleware/auth.cjs').requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.userId;

    const request = await prisma.supportRequest.findFirst({
      where: {
        id: requestId,
        userId // Ensure user can only access their own requests
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    res.json({ request });
  } catch (err) {
    console.error('Get support request error:', err);
    res.status(500).json({ error: 'Failed to retrieve support request' });
  }
});

module.exports = router;
