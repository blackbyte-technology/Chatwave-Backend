import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  verifyIntegration,
  getWhatsAppStatus,
  getTemplates,
  sendTemplateMessage,
  getAnalytics,
  getMessages,
  syncTemplates
} from '../controllers/integration.controller.js';

const router = express.Router();

// All integration routes are protected by the API key authentication
router.use(authenticate);

router.get('/verify', verifyIntegration);
router.get('/whatsapp/status', getWhatsAppStatus);
router.get('/templates', getTemplates);
router.post('/send-template', sendTemplateMessage);
router.get('/analytics', getAnalytics);
router.get('/messages', getMessages);
router.post('/sync-templates', syncTemplates);

export default router;

