import { WhatsappWaba, WhatsappConnection, Template, Message, Workspace } from '../models/index.js';
import UnifiedWhatsAppService from '../services/whatsapp/unified-whatsapp.service.js';
import { provisionTemplatesForWorkspace } from '../services/template-provisioner.service.js';

// GET /api/integration/verify
export const verifyIntegration = async (req, res) => {
  try {
    const user = req.user; // populated via API key auth
    
    // Find the first workspace (or default)
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const waba = await WhatsappWaba.findOne({ workspace_id: workspace._id, deleted_at: null });
    const connection = await WhatsappConnection.findOne({ workspace_id: workspace._id, deleted_at: null });

    return res.json({
      success: true,
      data: {
        workspace_id: workspace._id,
        workspace_name: workspace.name,
        whatsapp_status: (waba && connection) ? 'connected' : 'not_setup',
        connected_phone: connection ? connection.phone_number : null,
        waba_id: waba ? waba.waba_id : null
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

    const waba = await WhatsappWaba.findOne({ workspace_id: workspace._id, deleted_at: null });
    const connection = await WhatsappConnection.findOne({ workspace_id: workspace._id, deleted_at: null });

    return res.json({
      success: true,
      data: {
        status: (waba && connection) ? 'connected' : 'disconnected',
        phone_number: connection ? connection.phone_number : null,
        waba_id: waba ? waba.waba_id : null,
        last_connected: connection ? connection.updated_at : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/integration/templates
export const getTemplates = async (req, res) => {
  try {
    const user = req.user;
    const workspace = await Workspace.findOne({ user_id: user.id, deleted_at: null });
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    const templates = await Template.find({ workspace_id: workspace._id, deleted_at: null }).lean();
    
    return res.json({
      success: true,
      data: templates.map(t => ({
        id: t._id,
        name: t.name,
        category: t.category,
        language: t.language,
        status: t.status
      }))
    });
  } catch (error) {
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

    const template = await Template.findOne({ workspace_id: workspace._id, name: templateName, deleted_at: null });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    if (template.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Template is not approved' });
    }

    const whatsappService = new UnifiedWhatsAppService(workspace._id);
    
    // Construct template parameters depending on the unified whatsapp service's expected format
    // This assumes sending involves passing the template name and parameters for body components
    // Map variables array to body parameter format usually required by Meta API
    let components = [];
    if (variables && Array.isArray(variables) && variables.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.map(v => ({ type: 'text', text: String(v) }))
      });
    }

    const result = await whatsappService.sendTemplateMessage(contactNo, templateName, template.language, components);
    
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

    // Aggregate messaging stats using Message model
    // Assuming Message model has status (sent, delivered, read, failed)
    const stats = await Message.aggregate([
      { $match: { workspace_id: workspace._id, deleted_at: null } },
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
      Message.find({ workspace_id: workspace._id, deleted_at: null })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ workspace_id: workspace._id, deleted_at: null })
    ]);

    return res.json({
      success: true,
      data: {
        messages: messages.map(m => ({
          id: m._id,
          contact_number: m.contact_number || m.to,
          type: m.type,
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
      // Return updated template list
      const templates = await Template.find({ workspace_id: workspace._id, deleted_at: null }).lean();
      return res.json({
        success: true,
        message: 'Templates synced successfully',
        data: templates.map(t => ({
          id: t._id,
          name: t.name,
          category: t.category,
          language: t.language,
          status: t.status
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
