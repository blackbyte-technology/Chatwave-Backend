import { Template, WhatsappWaba } from '../models/index.js';
import UnifiedWhatsAppService from './whatsapp/unified-whatsapp.service.js';
import axios from 'axios';

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
    let waba = await WhatsappWaba.findOne({ workspace_id: workspaceId, deleted_at: null });
    if (!waba) {
      waba = await WhatsappWaba.findOne({ user_id: userId, is_active: true, deleted_at: null });
      if (waba && !waba.workspace_id) {
        waba.workspace_id = workspaceId;
        await waba.save();
      }
    }

    if (!waba || !waba.whatsapp_business_account_id) {
      console.log(`[TemplateProvisioner] WABA not found or connected for workspace ${workspaceId} / user ${userId}`);
      return false;
    }

    let provisionedCount = 0;

    // 1. Sync all existing templates from Meta Graph API for this WABA
    if (waba.access_token && waba.whatsapp_business_account_id) {
      try {
        const url = `https://graph.facebook.com/v21.0/${waba.whatsapp_business_account_id}/message_templates`;
        const response = await axios.get(url, {
          params: {
            fields: "id,name,status,category,language,components,rejected_reason,quality_score"
          },
          headers: {
            Authorization: `Bearer ${waba.access_token}`
          }
        });

        const metaTemplates = response.data.data || [];
        for (const metaT of metaTemplates) {
          try {
            const components = metaT.components || [];
            const category = (metaT.category || "UTILITY").toUpperCase();
            const bodyComponent = components.find(c => (c.type || "").toUpperCase() === "BODY");
            const headerComponent = components.find(c => (c.type || "").toUpperCase() === "HEADER");
            const footerComponent = components.find(c => (c.type || "").toUpperCase() === "FOOTER");
            const buttonComponent = components.find(c => (c.type || "").toUpperCase() === "BUTTONS");

            let header = null;
            if (headerComponent) {
              const format = (headerComponent.format || "").toUpperCase();
              if (format === "TEXT") {
                header = { format: "text", text: headerComponent.text };
              } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
                header = { format: "media", media_type: format.toLowerCase() };
              }
            }

            let buttons = [];
            if (buttonComponent && Array.isArray(buttonComponent.buttons)) {
              buttons = buttonComponent.buttons.map(btn => {
                const t = (btn.type || "").toUpperCase();
                if (t === "PHONE_NUMBER") return { type: "phone_call", text: btn.text, phone_number: btn.phone_number };
                if (t === "URL") return { type: "url", text: btn.text, url: btn.url };
                if (t === "QUICK_REPLY") return { type: "quick_reply", text: btn.text };
                return { type: t.toLowerCase(), text: btn.text || "" };
              });
            }

            const doc = {
              user_id: userId,
              waba_id: waba._id,
              template_name: (metaT.name || "").toLowerCase(),
              language: metaT.language || "en_US",
              category: ["UTILITY", "MARKETING", "AUTHENTICATION"].includes(category) ? category : "UTILITY",
              status: (metaT.status || "draft").toLowerCase(),
              meta_template_id: metaT.id,
              rejection_reason: metaT.rejected_reason || null,
              message_body: bodyComponent ? bodyComponent.text : "",
              header: header || undefined,
              footer_text: footerComponent ? footerComponent.text : undefined,
              buttons: buttons.length > 0 ? buttons : undefined
            };

            const existing = await Template.findOne({
              user_id: userId,
              meta_template_id: metaT.id
            });

            if (existing) {
              await Template.findByIdAndUpdate(existing._id, doc);
            } else {
              await Template.create(doc);
              provisionedCount++;
            }
          } catch (err) {
            console.error(`[TemplateProvisioner] Error saving synced template ${metaT.name}:`, err.message);
          }
        }
      } catch (metaErr) {
        console.error('[TemplateProvisioner] Error fetching templates from Meta Graph API:', metaErr.response?.data || metaErr.message);
      }
    }

    // 2. Ensure default system reminder templates exist locally
    for (const templateDef of DEFAULT_TEMPLATES) {
      try {
        const existingTemplate = await Template.findOne({
          user_id: userId,
          template_name: templateDef.name.toLowerCase(),
          deleted_at: null
        });

        if (!existingTemplate) {
          const bodyComp = templateDef.components.find(c => c.type === 'BODY');
          const headerComp = templateDef.components.find(c => c.type === 'HEADER');
          const footerComp = templateDef.components.find(c => c.type === 'FOOTER');

          await Template.create({
            user_id: userId,
            waba_id: waba._id,
            template_name: templateDef.name.toLowerCase(),
            category: templateDef.category,
            language: templateDef.language,
            message_body: bodyComp ? bodyComp.text : "",
            header: headerComp ? { format: 'text', text: headerComp.text } : undefined,
            footer_text: footerComp ? footerComp.text : undefined,
            status: 'draft'
          });
          provisionedCount++;
        }
      } catch (err) {
        console.error(`[TemplateProvisioner] Failed to provision default template ${templateDef.name}:`, err.message);
      }
    }

    console.log(`[TemplateProvisioner] Successfully processed templates for workspace ${workspaceId} (provisioned ${provisionedCount} new)`);
    return true;
  } catch (error) {
    console.error('[TemplateProvisioner] Error provisioning templates:', error);
    return false;
  }
};
