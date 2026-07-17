import { Template, WhatsappWaba } from '../models/index.js';
import UnifiedWhatsAppService from './whatsapp/unified-whatsapp.service.js';

const DEFAULT_TEMPLATES = [
  {
    name: 'id_policy_expiry_reminder',
    category: 'UTILITY',
    language: 'en',
    allow_category_change: true,
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Policy Expiry Alert'
      },
      {
        type: 'BODY',
        text: 'Dear {{1}},\n\nYour insurance policy {{2}} is expiring on {{3}}. Please renew it before the expiry date to ensure uninterrupted coverage.\n\nRegards,\n{{4}}'
      },
      {
        type: 'FOOTER',
        text: 'InsuranceDesk Reminders'
      }
    ]
  },
  {
    name: 'id_policy_renewal_reminder',
    category: 'UTILITY',
    language: 'en',
    allow_category_change: true,
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Policy Renewal'
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThis is a gentle reminder to renew your policy {{2}}. Your prompt action is appreciated.\n\nThank you,\n{{3}}'
      },
      {
        type: 'FOOTER',
        text: 'InsuranceDesk Reminders'
      }
    ]
  },
  {
    name: 'id_premium_due_reminder',
    category: 'UTILITY',
    language: 'en',
    allow_category_change: true,
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Premium Due'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}},\n\nYour premium payment for policy {{2}} is due on {{3}}. Please make the payment to avoid late fees.\n\nRegards,\n{{4}}'
      },
      {
        type: 'FOOTER',
        text: 'InsuranceDesk Reminders'
      }
    ]
  },
  {
    name: 'id_birthday_wishes',
    category: 'MARKETING',
    language: 'en',
    allow_category_change: true,
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Happy Birthday!'
      },
      {
        type: 'BODY',
        text: 'Dear {{1}},\n\nWishing you a very Happy Birthday! May your year be filled with joy and success.\n\nBest Wishes,\n{{2}}'
      }
    ]
  },
  {
    name: 'id_welcome_thank_you',
    category: 'MARKETING',
    language: 'en',
    allow_category_change: true,
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Welcome Aboard'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}},\n\nThank you for choosing us for your insurance needs. We are thrilled to have you with us!\n\nRegards,\n{{2}}'
      }
    ]
  },
  {
    name: 'id_follow_up_reminder',
    category: 'UTILITY',
    language: 'en',
    allow_category_change: true,
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Follow-Up'
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe wanted to follow up regarding your recent inquiry. Please let us know if you need any further assistance.\n\nThank you,\n{{2}}'
      }
    ]
  }
];

export const provisionTemplatesForWorkspace = async (workspaceId, userId) => {
  try {
    const waba = await WhatsappWaba.findOne({ workspace_id: workspaceId });
    if (!waba || !waba.waba_id) {
      console.log(`[TemplateProvisioner] WABA not found or connected for workspace ${workspaceId}`);
      return false;
    }

    const whatsappService = new UnifiedWhatsAppService(workspaceId);
    let provisionedCount = 0;

    for (const templateDef of DEFAULT_TEMPLATES) {
      const existingTemplate = await Template.findOne({
        workspace_id: workspaceId,
        name: templateDef.name
      });

      if (!existingTemplate) {
        // Try submitting to Meta
        try {
          // Note: createTemplate in UnifiedWhatsAppService requires waba_id
          const metaResponse = await whatsappService.createTemplate({
            ...templateDef,
            waba_id: waba.waba_id,
            workspace_id: workspaceId
          });
          
          if (metaResponse && metaResponse.id) {
            await Template.create({
              workspace_id: workspaceId,
              user_id: userId,
              name: templateDef.name,
              category: templateDef.category,
              language: templateDef.language,
              components: templateDef.components,
              template_id: metaResponse.id,
              status: metaResponse.status || 'PENDING'
            });
            provisionedCount++;
          }
        } catch (err) {
          console.error(`[TemplateProvisioner] Failed to provision template ${templateDef.name}:`, err.message);
        }
      }
    }
    
    console.log(`[TemplateProvisioner] Successfully provisioned ${provisionedCount} templates for workspace ${workspaceId}`);
    return true;
  } catch (error) {
    console.error('[TemplateProvisioner] Error provisioning templates:', error);
    return false;
  }
};
