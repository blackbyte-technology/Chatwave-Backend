import { Template, WhatsappWaba } from '../models/index.js';
import UnifiedWhatsAppService from './whatsapp/unified-whatsapp.service.js';
import axios from 'axios';

// ─── Meta Graph API Configuration ───────────────────────────────────────────
const META_GRAPH_API_VERSION = 'v21.0';
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

// ─── Default Templates ──────────────────────────────────────────────────────
// IMPORTANT: Meta rule — variables ({{1}}, {{2}}) must NOT be at the very start
// or very end of the body text. Always add static text before/after variables.
const DEFAULT_TEMPLATES = [
  {
    name: 'id_policy_expiry_reminder',
    category: 'UTILITY',
    language: 'en_US',
    allow_category_change: true,
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Policy Expiry Alert' },
      {
        type: 'BODY',
        text: 'Dear {{1}},\n\nYour insurance policy {{2}} is expiring on {{3}}. Please renew it before the expiry date to ensure uninterrupted coverage.\n\nRegards,\n{{4}} - Thank you.',
        example: { body_text: [['John Doe', 'POL-123456', '31-12-2026', 'Your Company']] }
      },
      { type: 'FOOTER', text: 'Powered by ChatWave' }
    ]
  },
  {
    name: 'id_policy_renewal_reminder',
    category: 'UTILITY',
    language: 'en_US',
    allow_category_change: true,
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Policy Renewal' },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThis is a gentle reminder to renew your policy {{2}}. Your prompt action is appreciated.\n\nThank you,\n{{3}} - Thank you.',
        example: { body_text: [['John Doe', 'POL-123456', 'Your Company']] }
      },
      { type: 'FOOTER', text: 'Powered by ChatWave' }
    ]
  },
  {
    name: 'id_premium_due_reminder',
    category: 'UTILITY',
    language: 'en_US',
    allow_category_change: true,
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Premium Due' },
      {
        type: 'BODY',
        text: 'Hi {{1}},\n\nYour premium payment for policy {{2}} is due on {{3}}. Please make the payment to avoid late fees.\n\nRegards,\n{{4}} - Thank you.',
        example: { body_text: [['John Doe', 'POL-123456', '31-12-2026', 'Your Company']] }
      },
      { type: 'FOOTER', text: 'Powered by ChatWave' }
    ]
  },
  {
    name: 'id_birthday_wishes',
    category: 'MARKETING',
    language: 'en_US',
    allow_category_change: true,
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Happy Birthday!' },
      {
        type: 'BODY',
        text: 'Dear {{1}},\n\nWishing you a very Happy Birthday! May your year be filled with joy and success.\n\nBest Wishes,\n{{2}} - Thank you.',
        example: { body_text: [['John Doe', 'Your Company']] }
      }
    ]
  },
  {
    name: 'id_welcome_thank_you',
    category: 'MARKETING',
    language: 'en_US',
    allow_category_change: true,
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Welcome Aboard' },
      {
        type: 'BODY',
        text: 'Hi {{1}},\n\nThank you for choosing us for your insurance needs. We are thrilled to have you with us!\n\nRegards,\n{{2}} - Thank you.',
        example: { body_text: [['John Doe', 'Your Company']] }
      }
    ]
  },
  {
    name: 'id_follow_up_reminder',
    category: 'UTILITY',
    language: 'en_US',
    allow_category_change: true,
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Follow-Up' },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe wanted to follow up regarding your recent inquiry. Please let us know if you need any further assistance.\n\nThank you,\n{{2}} - Thank you.',
        example: { body_text: [['John Doe', 'Your Company']] }
      }
    ]
  }
];

// ─── Utility: Sanitize body text for Meta compliance ────────────────────────
// Meta rejects templates where a variable is the very first or last token.
function sanitizeBodyTextForMeta(bodyText) {
  if (!bodyText || typeof bodyText !== 'string') return bodyText;
  let text = bodyText.trim();
  // Fix leading variable
  if (/^{{\d+}}/.test(text)) {
    text = 'Hello ' + text;
  }
  // Fix trailing variable (allow optional punctuation after it)
  if (/{{\d+}}[\s.!?,]*$/.test(text)) {
    text = text.replace(/({{(\d+)}})[\s.!?,]*$/, '$1 - Thank you.');
  }
  return text;
}

// ─── Utility: Extract example values for body variables ─────────────────────
function buildBodyExamples(bodyText) {
  const regex = /{{(\d+|[a-zA-Z0-9_]+)}}/g;
  const matches = [...new Set(Array.from(bodyText.matchAll(regex), m => m[1]))];
  if (matches.length === 0) return null;

  const isPositional = matches.every(m => /^\d+$/.test(m));
  if (isPositional) {
    matches.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const sampleValues = {
      1: 'John Doe',
      2: 'POL-123456',
      3: '31-12-2026',
      4: 'Your Company'
    };
    const examples = matches.map(m => sampleValues[m] || `Sample Value ${m}`);
    return { body_text: [examples] };
  } else {
    return {
      body_text_named_params: matches.map(m => ({
        param_name: m,
        example: m === 'name' ? 'John Doe' : m === 'policy' ? 'POL-123456' : 'Sample Value'
      }))
    };
  }
}

// ─── Utility: Build Meta-compatible components from a local template ────────
function buildMetaComponentsFromTemplate(template) {
  const components = [];

  // HEADER
  if (template.header && template.header.text) {
    components.push({ type: 'HEADER', format: 'TEXT', text: template.header.text });
  }

  // BODY (with sanitization and examples)
  if (template.message_body) {
    const bodyText = sanitizeBodyTextForMeta(template.message_body);
    const bodyComp = { type: 'BODY', text: bodyText };
    const examples = buildBodyExamples(bodyText);
    if (examples) bodyComp.example = examples;
    components.push(bodyComp);
  }

  // FOOTER
  if (template.footer_text) {
    components.push({ type: 'FOOTER', text: template.footer_text });
  }

  // BUTTONS
  if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
    const metaButtons = template.buttons.map(btn => {
      if (btn.type === 'phone_call') return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone_number };
      if (btn.type === 'url') return { type: 'URL', text: btn.text, url: btn.url };
      if (btn.type === 'quick_reply') return { type: 'QUICK_REPLY', text: btn.text };
      return null;
    }).filter(Boolean);
    if (metaButtons.length > 0) {
      components.push({ type: 'BUTTONS', buttons: metaButtons });
    }
  }

  return components;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: Provision templates for a workspace
// ═══════════════════════════════════════════════════════════════════════════════
export const provisionTemplatesForWorkspace = async (workspaceId, userId) => {
  try {
    // ── Resolve WABA ──────────────────────────────────────────────────────
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

    // ── Step 1: Sync all existing templates FROM Meta into local DB ──────
    if (waba.access_token && waba.whatsapp_business_account_id) {
      try {
        const url = `${META_GRAPH_BASE_URL}/${waba.whatsapp_business_account_id}/message_templates`;
        const response = await axios.get(url, {
          params: { fields: 'id,name,status,category,language,components,rejected_reason,quality_score' },
          headers: { Authorization: `Bearer ${waba.access_token}` }
        });

        const metaTemplates = response.data.data || [];
        for (const metaT of metaTemplates) {
          try {
            const components = metaT.components || [];
            const category = (metaT.category || 'UTILITY').toUpperCase();
            const bodyComponent = components.find(c => (c.type || '').toUpperCase() === 'BODY');
            const headerComponent = components.find(c => (c.type || '').toUpperCase() === 'HEADER');
            const footerComponent = components.find(c => (c.type || '').toUpperCase() === 'FOOTER');
            const buttonComponent = components.find(c => (c.type || '').toUpperCase() === 'BUTTONS');

            let header = null;
            if (headerComponent) {
              const format = (headerComponent.format || '').toUpperCase();
              if (format === 'TEXT') {
                header = { format: 'text', text: headerComponent.text };
              } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
                header = { format: 'media', media_type: format.toLowerCase() };
              }
            }

            let buttons = [];
            if (buttonComponent && Array.isArray(buttonComponent.buttons)) {
              buttons = buttonComponent.buttons.map(btn => {
                const t = (btn.type || '').toUpperCase();
                if (t === 'PHONE_NUMBER') return { type: 'phone_call', text: btn.text, phone_number: btn.phone_number };
                if (t === 'URL') return { type: 'url', text: btn.text, url: btn.url };
                if (t === 'QUICK_REPLY') return { type: 'quick_reply', text: btn.text };
                return { type: t.toLowerCase(), text: btn.text || '' };
              });
            }

            const doc = {
              user_id: userId,
              waba_id: waba._id,
              template_name: (metaT.name || '').toLowerCase(),
              language: metaT.language || 'en_US',
              category: ['UTILITY', 'MARKETING', 'AUTHENTICATION'].includes(category) ? category : 'UTILITY',
              status: (metaT.status || 'draft').toLowerCase(),
              meta_template_id: metaT.id,
              rejection_reason: metaT.rejected_reason || null,
              message_body: bodyComponent ? bodyComponent.text : '',
              header: header || undefined,
              footer_text: footerComponent ? footerComponent.text : undefined,
              buttons: buttons.length > 0 ? buttons : undefined
            };

            // Find existing by meta_template_id OR template_name (avoid duplicates)
            const existing = await Template.findOne({
              user_id: userId,
              $or: [
                { meta_template_id: metaT.id },
                { template_name: (metaT.name || '').toLowerCase() }
              ],
              deleted_at: null
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

    // ── Step 2: Ensure default InsuranceDesk templates exist locally ─────
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
            message_body: bodyComp ? bodyComp.text : '',
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

    // ── Step 3: Auto-submit all draft/unsubmitted templates TO Meta ──────
    await submitDraftTemplatesToMeta(waba, userId);

    console.log(`[TemplateProvisioner] Successfully processed templates for workspace ${workspaceId} (provisioned ${provisionedCount} new)`);
    return true;
  } catch (error) {
    console.error('[TemplateProvisioner] Error provisioning templates:', error);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Submit all draft templates to Meta for approval
// ═══════════════════════════════════════════════════════════════════════════════
async function submitDraftTemplatesToMeta(waba, userId) {
  if (!waba || !waba.access_token || !waba.whatsapp_business_account_id) {
    return;
  }

  try {
    // FIX: Use $and with nested $or to avoid MongoDB duplicate $or key problem
    const draftTemplates = await Template.find({
      user_id: userId,
      deleted_at: null,
      $and: [
        {
          $or: [
            { waba_id: waba._id },
            { waba_id: null },
            { waba_id: { $exists: false } }
          ]
        },
        {
          $or: [
            { status: 'draft' },
            { meta_template_id: null },
            { meta_template_id: { $exists: false } },
            { meta_template_id: '' }
          ]
        }
      ]
    });

    if (!draftTemplates || draftTemplates.length === 0) {
      console.log('[TemplateProvisioner] No draft/unsubmitted templates found. All good!');
      return;
    }

    console.log(`[TemplateProvisioner] Found ${draftTemplates.length} draft/unsubmitted templates to submit to Meta...`);

    for (const template of draftTemplates) {
      try {
        // Sanitize body text before submission
        const sanitizedBody = sanitizeBodyTextForMeta(template.message_body);
        if (sanitizedBody !== template.message_body) {
          template.message_body = sanitizedBody;
          await template.save();
          console.log(`[TemplateProvisioner] Sanitized body for ${template.template_name}`);
        }

        const components = buildMetaComponentsFromTemplate(template);

        const payload = {
          name: template.template_name,
          language: template.language || 'en_US',
          category: (template.category || 'UTILITY').toUpperCase(),
          components
        };

        const url = `${META_GRAPH_BASE_URL}/${waba.whatsapp_business_account_id}/message_templates`;
        const res = await axios.post(url, payload, {
          headers: {
            Authorization: `Bearer ${waba.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res && res.data && res.data.id) {
          console.log(`[TemplateProvisioner] ✅ Submitted ${template.template_name} → Meta ID: ${res.data.id}, Status: ${res.data.status}`);
          template.meta_template_id = res.data.id;
          template.status = (res.data.status || 'pending').toLowerCase();
          template.waba_id = waba._id;
          await template.save();
        }
      } catch (err) {
        const errorData = err.response?.data?.error || {};
        const errorMessage = errorData.message || err.message || '';
        const errorSubcode = errorData.error_subcode;

        console.log(`[TemplateProvisioner] Submission of ${template.template_name}: ${errorMessage} (subcode: ${errorSubcode})`);

        // Handle "already exists" — sync status from Meta instead
        if (
          errorSubcode === 2388027 ||
          errorMessage.toLowerCase().includes('already exists') ||
          errorMessage.toLowerCase().includes('duplicate')
        ) {
          await syncExistingTemplateFromMeta(waba, template);
        } else {
          console.error(`[TemplateProvisioner] ❌ Failed to submit ${template.template_name}:`, JSON.stringify(errorData));
        }
      }
    }
  } catch (error) {
    console.error('[TemplateProvisioner] Error in submitDraftTemplatesToMeta:', error.message);
  }
}

// ─── Helper: Sync status of an existing template from Meta ──────────────────
async function syncExistingTemplateFromMeta(waba, template) {
  try {
    const checkUrl = `${META_GRAPH_BASE_URL}/${waba.whatsapp_business_account_id}/message_templates?name=${template.template_name}`;
    const checkRes = await axios.get(checkUrl, {
      headers: { Authorization: `Bearer ${waba.access_token}` }
    });
    const matchingList = checkRes.data?.data || [];
    if (matchingList.length > 0) {
      const metaObj = matchingList[0];
      template.meta_template_id = metaObj.id;
      template.status = (metaObj.status || 'pending').toLowerCase();
      template.rejection_reason = metaObj.rejected_reason || null;
      template.waba_id = waba._id;
      await template.save();
      console.log(`[TemplateProvisioner] 🔄 Synced existing ${template.template_name}: ${template.status}`);
    }
  } catch (checkErr) {
    console.error(`[TemplateProvisioner] Could not lookup existing status for ${template.template_name}:`, checkErr.message);
  }
}
