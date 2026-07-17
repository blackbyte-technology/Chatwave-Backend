import { WhatsappWaba, WhatsappConnection, Template, Message, Workspace, WhatsappPhoneNumber } from '../models/index.js';
import UnifiedWhatsAppService from '../services/whatsapp/unified-whatsapp.service.js';
import { provisionTemplatesForWorkspace } from '../services/template-provisioner.service.js';

// Helper to resolve active WABA for workspace/user
const getActiveWaba = async (workspaceId, userId) => {
  let waba = await WhatsappWaba.findOne({ workspace_id: workspaceId, deleted_at: null });
  if (!waba) {
    waba = await WhatsappWaba.findOne({ user_id: userId, is_active: true, deleted_at: null });
    if (waba && !waba.workspace_id) {
      waba.workspace_id = workspaceId;
      await waba.save();
    }
  }
  return waba;
};

// GET /api/integration/verify
export const verifyIntegration = async (req, res) => {
  try {
    const user = req.user; // populated via API key auth
    
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const waba = await getActiveWaba(workspace._id, user.id);
    const connection = waba ? (await WhatsappConnection.findOne({ whatsapp_business_account_id: waba.whatsapp_business_account_id, deleted_at: null }) || await WhatsappConnection.findOne({ user_id: user.id, is_active: true, deleted_at: null })) : null;

    const isConnected = !!(waba && waba.whatsapp_business_account_id && (waba.access_token || connection?.access_token));
    const phoneDoc = waba ? await WhatsappPhoneNumber.findOne({ waba_id: waba._id, deleted_at: null }) : null;
    const phone = phoneDoc?.display_phone_number || connection?.registred_phone_number || connection?.phone_number || null;

    return res.json({
      success: true,
      data: {
        workspace_id: workspace._id,
        workspace_name: workspace.name,
        whatsapp_status: isConnected ? 'connected' : 'not_setup',
        connected_phone: phone,
        waba_id: waba ? (waba.whatsapp_business_account_id || waba._id.toString()) : null
      }
    });
  } catch (error) {
    console.error('Verify integration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/integration/whatsapp/status
export const getWhatsAppStatus = async (req, res) => {
  try {
    const user = req.user;
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const waba = await getActiveWaba(workspace._id, user.id);
    const connection = waba ? (await WhatsappConnection.findOne({ whatsapp_business_account_id: waba.whatsapp_business_account_id, deleted_at: null }) || await WhatsappConnection.findOne({ user_id: user.id, is_active: true, deleted_at: null })) : null;

    const isConnected = !!(waba && waba.whatsapp_business_account_id && (waba.access_token || connection?.access_token));
    const phoneDoc = waba ? await WhatsappPhoneNumber.findOne({ waba_id: waba._id, deleted_at: null }) : null;
    const phone = phoneDoc?.display_phone_number || connection?.registred_phone_number || connection?.phone_number || null;

    return res.json({
      success: true,
      data: {
        status: isConnected ? 'connected' : 'disconnected',
        phone_number: phone,
        waba_id: waba ? (waba.whatsapp_business_account_id || waba._id.toString()) : null,
        last_connected: connection?.updated_at || waba?.updated_at || null
      }
    });
  } catch (error) {
    console.error('Get whatsapp status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/integration/templates
export const getTemplates = async (req, res) => {
  try {
    const user = req.user;
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const waba = await getActiveWaba(workspace._id, user.id);
    const query = {
      user_id: user.id,
      ...(waba ? { waba_id: waba._id } : {}),
      deleted_at: null
    };

    const templates = await Template.find(query).lean();
    
    return res.json({
      success: true,
      data: templates.map(t => ({
        id: t._id,
        name: t.template_name || t.name,
        category: t.category || 'UTILITY',
        language: t.language || 'en_US',
        status: t.status ? t.status.toUpperCase() : 'DRAFT',
        rejection_reason: t.rejection_reason || null,
        meta_template_id: t.meta_template_id || null,
        last_synced_at: t.updatedAt || t.updated_at || null
      }))
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/integration/send-template
export const sendTemplateMessage = async (req, res) => {
  try {
    const user = req.user;
    const { contactNo, templateName, variables } = req.body;
    
    if (!contactNo || !templateName) {
      return res.status(400).json({ success: false, message: 'Contact number and template name are required' });
    }

    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const waba = await getActiveWaba(workspace._id, user.id);
    const query = {
      user_id: user.id,
      ...(waba ? { waba_id: waba._id } : {}),
      template_name: templateName.toLowerCase(),
      deleted_at: null
    };

    const template = await Template.findOne(query);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    if (template.status?.toUpperCase() !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Template is not approved' });
    }

    const whatsappService = new UnifiedWhatsAppService(workspace._id);
    
    let components = [];
    if (variables && Array.isArray(variables) && variables.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.map(v => ({ type: 'text', text: String(v) }))
      });
    }

    const result = await whatsappService.sendMessage(user.id, {
      recipientNumber: contactNo,
      messageType: 'template',
      templateName: template.template_name,
      languageCode: template.language || 'en_US',
      templateObj: template,
      templateId: template._id,
      templateComponents: components
    });
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Send template error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send message' });
  }
};

// GET /api/integration/analytics
export const getAnalytics = async (req, res) => {
  try {
    const user = req.user;
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const stats = await Message.aggregate([
      { $match: { user_id: user.id, deleted_at: null } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0
    };

    stats.forEach(stat => {
      const status = stat._id ? stat._id.toLowerCase() : 'unknown';
      if (formattedStats[status] !== undefined) {
        formattedStats[status] = stat.count;
      }
    });

    return res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/integration/messages
export const getMessages = async (req, res) => {
  try {
    const user = req.user;
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ user_id: user.id, deleted_at: null })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ user_id: user.id, deleted_at: null })
    ]);

    return res.json({
      success: true,
      data: {
        messages: messages.map(m => ({
          id: m._id,
          contact_number: m.contact_number || m.recipient_number || m.to,
          type: m.message_type || m.type,
          status: m.status,
          template_name: m.template_name || null,
          created_at: m.created_at
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/integration/sync-templates
export const syncTemplates = async (req, res) => {
  try {
    const user = req.user;
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const result = await provisionTemplatesForWorkspace(workspace._id, user.id);

    if (result) {
      const waba = await getActiveWaba(workspace._id, user.id);
      const query = {
        user_id: user.id,
        ...(waba ? { waba_id: waba._id } : {}),
        deleted_at: null
      };
      const templates = await Template.find(query).lean();
      return res.json({
        success: true,
        message: 'Templates synced successfully',
        data: templates.map(t => ({
          id: t._id,
          name: t.template_name || t.name,
          category: t.category || 'UTILITY',
          language: t.language || 'en_US',
          status: t.status ? t.status.toUpperCase() : 'DRAFT',
          rejection_reason: t.rejection_reason || null,
          meta_template_id: t.meta_template_id || null,
          last_synced_at: t.updatedAt || t.updated_at || null
        }))
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to sync templates. Ensure WhatsApp Business is connected in your workspace.'
      });
    }
  } catch (error) {
    console.error('Sync templates error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
