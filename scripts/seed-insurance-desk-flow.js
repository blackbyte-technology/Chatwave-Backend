#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Insurance Desk — Meta Ads → WhatsApp Automation Flow (Seed Script)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Creates a complete lead-qualification automation flow that converts
 *  Meta Ad (CTWA) clicks into 30-Day Free Trial sign-ups.
 *
 *  Usage:
 *    node scripts/seed-insurance-desk-flow.js <userId>
 *
 *  Example:
 *    node scripts/seed-insurance-desk-flow.js 665a1b2c3d4e5f6a7b8c9d0e
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Placeholder URLs (update before production) ─────────────────────
const TRIAL_URL = 'https://insurancedesk.co.in/free-trial';
const DEMO_URL = 'https://calendly.com/insurancedesk/demo';
const SALES_PHONE = '+918153026777';
const DEMO_VIDEO = 'https://www.youtube.com/playlist?list=PLa1GQZqyUPl4qCmkLI8fFRrU7KK3z9yVq&si=hKPZkIiuWW-GLgtf';

// ─── Tag Definitions ─────────────────────────────────────────────────
const TAG_DEFS = [
  // Source
  { label: 'Meta_Lead', color: '#6366f1' },
  // Current System
  { label: 'Using_Excel', color: '#f59e0b' },
  { label: 'Using_Diary', color: '#f59e0b' },
  { label: 'Using_CRM', color: '#f59e0b' },
  { label: 'No_System', color: '#f59e0b' },
  // Portfolio Size
  { label: 'Renewals_0_20', color: '#10b981' },
  { label: 'Renewals_20_50', color: '#10b981' },
  { label: 'Renewals_50_100', color: '#10b981' },
  { label: 'Renewals_100Plus', color: '#10b981' },
  // User Intent
  { label: 'Trial_Clicked', color: '#3b82f6' },
  { label: 'Demo_Booked', color: '#8b5cf6' },
  { label: 'Sales_Interested', color: '#ef4444' },
  { label: 'Price_Concern', color: '#ef4444' },
  { label: 'Need_Followup', color: '#f97316' },
  { label: 'No_Response', color: '#6b7280' },
];


// ═══════════════════════════════════════════════════════════════════════
//  NODE BUILDERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Helper: builds a send_message node with interactive LIST
 */
function listMsg(id, name, body, header, footer, buttonTitle, sectionTitle, items, x, y) {
  return {
    id: `send_message-${id}`, type: 'send_message',
    position: { x, y },
    name,
    description: '',
    parameters: {
      recipient: '{{senderNumber}}',
      message_template: body,
      interactive_type: 'list',
      list_params: {
        header,
        body,
        footer,
        buttonTitle,
        sectionTitle,
        items   // [{ title, description, id }]
      }
    }
  };
}

/**
 * Helper: builds a send_message node with interactive BUTTONS (max 3)
 */
function btnMsg(id, name, body, buttons, x, y) {
  return {
    id: `send_message-${id}`, type: 'send_message',
    position: { x, y },
    name,
    description: '',
    parameters: {
      recipient: '{{senderNumber}}',
      message_template: body,
      interactive_type: 'button',
      button_params: buttons  // [{ title, id }]
    }
  };
}

/**
 * Helper: builds a plain text send_message node
 */
function textMsg(id, name, body, x, y) {
  return {
    id: `send_message-${id}`, type: 'send_message',
    position: { x, y },
    name,
    description: '',
    parameters: {
      recipient: '{{senderNumber}}',
      message_template: body
    }
  };
}

/**
 * Helper: builds a CTA URL button node
 */
function ctaBtn(id, name, body, buttonText, url, x, y) {
  return {
    id: `cta_button-${id}`, type: 'cta_button',
    position: { x, y },
    name,
    description: '',
    parameters: {
      recipient: '{{senderNumber}}',
      message_template: body,
      url,
      button_text: buttonText
    }
  };
}

/**
 * Helper: builds an add_tag node
 */
function addTag(id, name, tagName, x, y) {
  return {
    id: `add_tag-${id}`, type: 'add_tag',
    position: { x, y },
    name,
    description: '',
    parameters: { tag_name: tagName }
  };
}

/**
 * Helper: builds a wait_for_reply node
 */
function waitReply(id, name, x, y, timeoutValue = null, timeoutUnit = null) {
  const params = { variable_name: 'last_user_message' };
  if (timeoutValue && timeoutUnit) {
    params.timeout_value = timeoutValue;
    params.timeout_unit = timeoutUnit;
  }
  return {
    id: `wait_for_reply-${id}`, type: 'wait_for_reply',
    position: { x, y },
    name,
    description: '',
    parameters: params
  };
}

/**
 * Helper: builds a condition node with multi-branch routing
 */
function conditionNode(id, name, conditions, noMatchHandle, x, y) {
  return {
    id: `condition-${id}`, type: 'condition',
    position: { x, y },
    name,
    description: '',
    parameters: {
      conditions,     // [{ id, field, operator, value, sourceHandle }]
      no_match_handle: 'no_match'
    }
  };
}

/**
 * Helper: builds a connection
 */
let connCounter = 0;
function conn(source, target, sourceHandle = 'src', targetHandle = 'tgt') {
  connCounter++;
  return {
    id: `conn-${connCounter}`,
    source,
    target,
    sourceHandle,
    targetHandle
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  BUILD THE COMPLETE FLOW
// ═══════════════════════════════════════════════════════════════════════

function buildFlow(userId) {
  connCounter = 0;

  // ─── Layout Constants ────────────────────────────────────────────
  // Node cards are ~288px wide. Columns spaced 400px apart.
  const CX = 600;          // center spine
  const C1 = 0;            // branch column 1 (far left)
  const C2 = 400;          // branch column 2
  const C3 = 800;          // branch column 3
  const C4 = 1200;         // branch column 4
  const C5 = 1600;         // branch column 5 (far right)

  // ═══════════════════════════════════════════════════════════════
  //  PHASE 1: TRIGGER & WELCOME  (center spine)
  // ═══════════════════════════════════════════════════════════════

  const trigger = {
    id: 'trigger-main',
    type: 'trigger',
    position: { x: CX, y: 0 },
    name: 'Meta Ad Click',
    description: 'Triggers when a WhatsApp message is received (CTWA Ad)',
    parameters: {}
  };

  const tagMetaLead = addTag('tag-meta-lead', 'Tag: Meta Lead', 'Meta_Lead', CX, 220);

  const sendWelcome = listMsg(
    'send-welcome',
    'Welcome Message',
    '👋 *Welcome to Insurance Desk!*\n\nTell us one thing...\n\n*How do you currently manage your insurance renewals?*',
    'Insurance Desk',
    'Select one option below',
    'Choose Option',
    'Current System',
    [
      { title: '📒 Excel', description: 'I use spreadsheets', id: 'system_excel' },
      { title: '📅 Diary', description: 'I use a diary or notebook', id: 'system_diary' },
      { title: '💻 CRM', description: 'I already use a CRM', id: 'system_crm' },
      { title: '🤔 Nothing', description: 'No system yet', id: 'system_nothing' }
    ],
    CX, 440
  );

  const waitSystem = waitReply('wait-system', 'Wait: System Choice', CX, 740);

  const condSystem = conditionNode(
    'cond-system',
    'Route: System Choice',
    [
      { id: 'c_excel', field: 'last_user_message', operator: 'equals', value: 'system_excel', sourceHandle: 'handle_excel' },
      { id: 'c_diary', field: 'last_user_message', operator: 'equals', value: 'system_diary', sourceHandle: 'handle_diary' },
      { id: 'c_crm', field: 'last_user_message', operator: 'equals', value: 'system_crm', sourceHandle: 'handle_crm' },
      { id: 'c_nothing', field: 'last_user_message', operator: 'equals', value: 'system_nothing', sourceHandle: 'handle_nothing' }
    ],
    'no_match',
    CX, 960
  );

  // ═══════════════════════════════════════════════════════════════
  //  PHASE 2: SYSTEM-SPECIFIC RESPONSES (4 branches)
  // ═══════════════════════════════════════════════════════════════

  const branchY = 1400;

  // ── Excel Branch (Column 1) ──
  const tagExcel = addTag('tag-excel', 'Tag: Using Excel', 'Using_Excel', C1, branchY);
  const sendPainExcel = textMsg(
    'send-pain-excel', 'Pain: Excel',
    'We understand. 📊\n\nMany insurance advisors using Excel miss important follow-ups because there are no automatic reminders.\n\n*Insurance Desk automates the entire renewal process.*',
    C1, branchY + 220
  );

  // ── Diary Branch (Column 2) ──
  const tagDiary = addTag('tag-diary', 'Tag: Using Diary', 'Using_Diary', C2, branchY);
  const sendPainDiary = textMsg(
    'send-pain-diary', 'Pain: Diary',
    'Many advisors lose renewals simply because they forget to follow up on time. 📅\n\n*Insurance Desk automatically reminds you before every renewal.*',
    C2, branchY + 220
  );

  // ── CRM Branch (Column 3) ──
  const tagCrm = addTag('tag-crm', 'Tag: Using CRM', 'Using_CRM', C3, branchY);
  const sendCrmAsk = listMsg(
    'send-crm-ask', 'CRM: What\'s Missing?',
    'That\'s great! 👍\n\nCan we ask one quick question?\n\n*What is missing in your current CRM?*',
    'Quick Question',
    'Select one',
    'Choose',
    'Missing Features',
    [
      { title: 'Renewal Reminders', description: 'Auto reminders before expiry', id: 'crm_reminders' },
      { title: 'WhatsApp Integration', description: 'Send messages via WhatsApp', id: 'crm_whatsapp' },
      { title: 'Mobile App', description: 'Access from phone', id: 'crm_mobile' },
      { title: 'Price', description: 'Current CRM is too expensive', id: 'crm_price' }
    ],
    C3, branchY + 220
  );
  const waitCrm = waitReply('wait-crm', 'Wait: CRM Response', C3, branchY + 520);
  const sendCrmResp = textMsg(
    'send-crm-resp', 'CRM: Response',
    'Thanks for sharing! 🙏\n\nInsurance Desk is built specifically for insurance advisors with all these features built-in.\n\nLet us show you how it works.',
    C3, branchY + 740
  );

  // ── Nothing Branch (Column 4) ──
  const tagNothing = addTag('tag-nothing', 'Tag: No System', 'No_System', C4, branchY);
  const sendPainNothing = textMsg(
    'send-pain-nothing', 'Pain: No System',
    'You\'re not alone. 🤝\n\nMany successful advisors begin with manual work.\n\n*Insurance Desk helps organize your customers, policies and renewals from Day 1.*',
    C4, branchY + 220
  );

  // ═══════════════════════════════════════════════════════════════
  //  PHASE 3: RENEWAL VOLUME QUESTION (center spine)
  // ═══════════════════════════════════════════════════════════════

  const volY = 2500;

  const sendVolume = listMsg(
    'send-volume', 'Renewal Volume Question',
    'Approximately how many renewals do you handle every month? 📋',
    'Renewal Volume',
    'This helps us personalize your experience',
    'Select Range',
    'Monthly Renewals',
    [
      { title: '0 – 20', description: 'Just starting out', id: 'vol_0_20' },
      { title: '20 – 50', description: 'Growing portfolio', id: 'vol_20_50' },
      { title: '50 – 100', description: 'Large portfolio', id: 'vol_50_100' },
      { title: '100+', description: 'Enterprise level', id: 'vol_100_plus' }
    ],
    CX, volY
  );

  const waitVolume = waitReply('wait-volume', 'Wait: Volume Choice', CX, volY + 300);

  const condVolume = conditionNode(
    'cond-volume',
    'Route: Volume Choice',
    [
      { id: 'cv_0_20', field: 'last_user_message', operator: 'equals', value: 'vol_0_20', sourceHandle: 'handle_v0' },
      { id: 'cv_20_50', field: 'last_user_message', operator: 'equals', value: 'vol_20_50', sourceHandle: 'handle_v20' },
      { id: 'cv_50_100', field: 'last_user_message', operator: 'equals', value: 'vol_50_100', sourceHandle: 'handle_v50' },
      { id: 'cv_100_plus', field: 'last_user_message', operator: 'equals', value: 'vol_100_plus', sourceHandle: 'handle_v100' }
    ],
    'no_match',
    CX, volY + 520
  );

  // ═══════════════════════════════════════════════════════════════
  //  PHASE 4: DYNAMIC VOLUME RESPONSES (4 branches)
  // ═══════════════════════════════════════════════════════════════

  const volRespY = 3500;

  // ── 0-20 (Column 1) ──
  const tagV0 = addTag('tag-vol-0-20', 'Tag: 0-20 Renewals', 'Renewals_0_20', C1, volRespY);
  const sendV0 = textMsg(
    'send-vol-0-20', 'Response: 0-20',
    'Perfect. 👌\n\nNow is the best time to build an organized renewal process before your business grows.',
    C1, volRespY + 220
  );

  // ── 20-50 (Column 2) ──
  const tagV20 = addTag('tag-vol-20-50', 'Tag: 20-50 Renewals', 'Renewals_20_50', C2, volRespY);
  const sendV20 = textMsg(
    'send-vol-20-50', 'Response: 20-50',
    'Excellent. 🚀\n\nAutomation starts saving hours every week at this stage.',
    C2, volRespY + 220
  );

  // ── 50-100 (Column 3) ──
  const tagV50 = addTag('tag-vol-50-100', 'Tag: 50-100 Renewals', 'Renewals_50_100', C3, volRespY);
  const sendV50 = textMsg(
    'send-vol-50-100', 'Response: 50-100',
    'You\'re managing a large portfolio. 📈\n\nAutomatic reminders can save significant time and improve customer retention.',
    C3, volRespY + 220
  );

  // ── 100+ (Column 4) ──
  const tagV100 = addTag('tag-vol-100-plus', 'Tag: 100+ Renewals', 'Renewals_100Plus', C4, volRespY);
  const sendV100 = textMsg(
    'send-vol-100-plus', 'Response: 100+',
    'That\'s a significant portfolio. 💼\n\nMissing even a few renewals every month could mean losing thousands in commission.\n\n*Insurance Desk ensures you never miss an opportunity.*',
    C4, volRespY + 220
  );

  // ═══════════════════════════════════════════════════════════════
  //  PHASE 5: SOCIAL PROOF & TRIAL OFFER (center spine)
  // ═══════════════════════════════════════════════════════════════

  const spY = 4200;

  const sendSocialProof = textMsg(
    'send-social-proof', 'Social Proof',
    '⭐⭐⭐⭐⭐\n\n*Thousands of insurance policies* are already being managed through Insurance Desk.\n\nInsurance advisors save hours every week using:\n\n✅ Renewal Automation\n✅ WhatsApp Reminders\n✅ Customer Mobile App\n✅ AI Policy Entry\n✅ Business Reports',
    CX, spY
  );

  const sendTrialOffer = listMsg(
    'send-trial-offer', 'Trial Offer',
    '🎉 *Great News!*\n\nYou\'re eligible for a *FREE 30-Day Trial.*\n\n✔ No Credit Card\n✔ No Setup Charges\n✔ No Commitment\n\n👇 What would you like to do?',
    '🎉 Free Trial',
    'Choose an option below',
    'Select Option',
    'Next Steps',
    [
      { title: '🚀 Start FREE Trial', description: 'Activate your 30-day trial now', id: 'trial_start' },
      { title: '📅 Book Demo', description: 'Schedule a 15-min demo', id: 'trial_demo' },
      { title: '☎ Talk to Sales', description: 'Speak with our CRM specialist', id: 'trial_sales' },
      { title: '❓ Ask a Question', description: 'Learn more before deciding', id: 'trial_question' }
    ],
    CX, spY + 300
  );

  const waitTrial = waitReply('wait-trial', 'Wait: Trial Choice', CX, spY + 600, 2, 'minutes');

  const condTrial = conditionNode(
    'cond-trial',
    'Route: Trial Choice',
    [
      { id: 'ct_start', field: 'last_user_message', operator: 'equals', value: 'trial_start', sourceHandle: 'handle_trial' },
      { id: 'ct_demo', field: 'last_user_message', operator: 'equals', value: 'trial_demo', sourceHandle: 'handle_demo' },
      { id: 'ct_sales', field: 'last_user_message', operator: 'equals', value: 'trial_sales', sourceHandle: 'handle_sales' },
      { id: 'ct_question', field: 'last_user_message', operator: 'equals', value: 'trial_question', sourceHandle: 'handle_question' }
    ],
    'no_match',
    CX, spY + 820
  );

  // ═══════════════════════════════════════════════════════════════
  //  PHASE 6: FINAL CTA BRANCHES (5 branches)
  // ═══════════════════════════════════════════════════════════════

  const ctaY = 5500;

  // ── Trial Branch (Column 1) ──
  const tagTrial = addTag('tag-trial', 'Tag: Trial Clicked', 'Trial_Clicked', C1, ctaY);
  const sendTrialActivate = textMsg(
    'send-trial-activate', 'Trial: Activation',
    'Excellent choice! 🎉\n\nFor the next *30 days*, you\'ll get access to Premium features including:\n\n• Unlimited Clients\n• AI Policy Upload\n• WhatsApp Marketing\n• Customer App\n• Renewal Automation\n• Reports & Analytics\n\n👇 Click below to activate your account.',
    C1, ctaY + 250
  );
  const ctaActivate = ctaBtn(
    'cta-activate', 'CTA: Activate Trial',
    '🚀 Activate your FREE 30-Day Trial now!',
    '🚀 Activate Trial', TRIAL_URL,
    C1, ctaY + 530
  );

  // ── Demo Branch (Column 2) ──
  const tagDemo = addTag('tag-demo', 'Tag: Demo Booked', 'Demo_Booked', C2, ctaY);
  const sendDemo = textMsg(
    'send-demo', 'Demo: Booking',
    'Perfect! 📅\n\nOur product expert will personally demonstrate how Insurance Desk can help your business.\n\n⏱ Duration: Only *15 Minutes*\n\n👇 Click below to pick a time.',
    C2, ctaY + 250
  );
  const ctaDemo = ctaBtn(
    'cta-demo', 'CTA: Schedule Demo',
    '📅 Schedule your FREE demo session',
    '📅 Schedule Demo', DEMO_URL,
    C2, ctaY + 530
  );

  // ── Sales Branch (Column 3) ──
  const tagSales = addTag('tag-sales', 'Tag: Sales Interested', 'Sales_Interested', C3, ctaY);
  const sendSalesOptions = btnMsg(
    'send-sales', 'Sales: Options',
    'Our Insurance CRM specialists are available to help. 🤝\n\nChoose your preferred option:',
    [
      { title: '📞 Call Now', id: 'sales_call' },
      { title: '💬 WhatsApp Sales', id: 'sales_wa' },
      { title: '📅 Schedule', id: 'sales_schedule' }
    ],
    C3, ctaY + 250
  );

  // ── Question Branch (Column 4) ──
  const sendQuestion = textMsg(
    'send-question', 'Question: Topics',
    'No worries! 😊\n\nAsk us anything about:\n\n• 💰 Pricing\n• ⚡ Features\n• 🔄 Migration\n• 🛠 Support\n• 🚀 Setup\n\nOur team is here to help. Just type your question!',
    C4, ctaY
  );

  // ── Sales sub-routing (under Column 3) ──
  const waitSales = waitReply('wait-sales', 'Wait: Sales Choice', C3, ctaY + 530);
  const condSales = conditionNode(
    'cond-sales',
    'Route: Sales Choice',
    [
      { id: 'cs_call', field: 'last_user_message', operator: 'equals', value: 'sales_call', sourceHandle: 'handle_s_call' },
      { id: 'cs_wa', field: 'last_user_message', operator: 'equals', value: 'sales_wa', sourceHandle: 'handle_s_wa' },
      { id: 'cs_schedule', field: 'last_user_message', operator: 'equals', value: 'sales_schedule', sourceHandle: 'handle_s_schedule' }
    ],
    null,
    C3, ctaY + 750
  );
  const sendSalesCall = textMsg(
    'send-sales-call', 'Sales: Call',
    `📞 Call our specialist now:\n\n${SALES_PHONE}\n\nWe're available Mon-Sat, 10 AM - 7 PM`,
    C2, ctaY + 1050
  );
  const sendSalesWa = textMsg(
    'send-sales-wa', 'Sales: WhatsApp',
    'A sales specialist will message you shortly. 💬\n\nPlease share your name and which insurance types you handle.',
    C3, ctaY + 1050
  );
  const sendSalesSchedule = ctaBtn(
    'send-sales-schedule', 'Sales: Schedule Meeting',
    '📅 Schedule a call with our specialist',
    '📅 Schedule Meeting', DEMO_URL,
    C4, ctaY + 1050
  );

  // ═══════════════════════════════════════════════════════════════
  //  PHASE 7: FOLLOW-UP SEQUENCE (Column 5 — far right)
  // ═══════════════════════════════════════════════════════════════

  const fuY = ctaY;

  const tagFollowup = addTag('tag-followup', 'Tag: Need Follow-up', 'Need_Followup', C5, fuY);

  // ── Reminder 1 ──
  const sendR1 = btnMsg(
    'send-reminder-1', 'Reminder 1 (2 min)',
    '😊 Just checking...\n\nEven missing one renewal every week can cost more than the price of a CRM.\n\nWould you like to see how Insurance Desk prevents this?',
    [
      { title: '👍 Yes', id: 'r1_yes' },
      { title: '⏰ Later', id: 'r1_later' }
    ],
    C5, fuY + 250
  );

  const waitR1 = waitReply('wait-r1', 'Wait: Reminder 1', C5, fuY + 530, 12, 'hours');

  const condR1 = conditionNode(
    'cond-r1', 'Route: Reminder 1',
    [
      { id: 'cr1_yes', field: 'last_user_message', operator: 'equals', value: 'r1_yes', sourceHandle: 'handle_r1_yes' }
    ],
    'no_match',
    C5, fuY + 750
  );

  // ── Reminder 2 ──
  const sendR2 = btnMsg(
    'send-reminder-2', 'Reminder 2 (12 hrs)',
    'Still thinking? 🤔\n\nYour *FREE Trial* is reserved for you.\n\nIt expires soon. ⏳',
    [
      { title: '🚀 Start Trial', id: 'r2_trial' },
      { title: '☎ Talk to Sales', id: 'r2_sales' }
    ],
    C5, fuY + 1050
  );

  const waitR2 = waitReply('wait-r2', 'Wait: Reminder 2', C5, fuY + 1330, 24, 'hours');

  const condR2 = conditionNode(
    'cond-r2', 'Route: Reminder 2',
    [
      { id: 'cr2_trial', field: 'last_user_message', operator: 'equals', value: 'r2_trial', sourceHandle: 'handle_r2_trial' },
      { id: 'cr2_sales', field: 'last_user_message', operator: 'equals', value: 'r2_sales', sourceHandle: 'handle_r2_sales' }
    ],
    'no_match',
    C5, fuY + 1550
  );

  // ── Reminder 3 ──
  const sendR3 = btnMsg(
    'send-reminder-3', 'Reminder 3 (24 hrs)',
    'Many insurance advisors recover their CRM cost simply by saving missed renewals. 💡\n\nDon\'t miss the opportunity. 👇',
    [
      { title: '🚀 Start Trial', id: 'r3_trial' },
      { title: '📅 Book Demo', id: 'r3_demo' }
    ],
    C5, fuY + 1850
  );

  const waitR3 = waitReply('wait-r3', 'Wait: Reminder 3', C5, fuY + 2130, 72, 'hours');

  const condR3 = conditionNode(
    'cond-r3', 'Route: Reminder 3',
    [
      { id: 'cr3_trial', field: 'last_user_message', operator: 'equals', value: 'r3_trial', sourceHandle: 'handle_r3_trial' },
      { id: 'cr3_demo', field: 'last_user_message', operator: 'equals', value: 'r3_demo', sourceHandle: 'handle_r3_demo' }
    ],
    'no_match',
    C5, fuY + 2350
  );

  // ── Final Reminder ──
  const sendFinal = btnMsg(
    'send-final-reminder', 'Final Reminder (3 days)',
    'This is our final reminder. ⚠️\n\nYour *FREE Trial* will expire shortly.\n\nWould you like to activate it before it closes?',
    [
      { title: '🚀 Start Trial', id: 'final_trial' },
      { title: '☎ Talk to Sales', id: 'final_sales' }
    ],
    C5, fuY + 2650
  );

  const waitFinal = waitReply('wait-final', 'Wait: Final', C5, fuY + 2930, 24, 'hours');

  const condFinal = conditionNode(
    'cond-final', 'Route: Final',
    [
      { id: 'cf_trial', field: 'last_user_message', operator: 'equals', value: 'final_trial', sourceHandle: 'handle_f_trial' },
      { id: 'cf_sales', field: 'last_user_message', operator: 'equals', value: 'final_sales', sourceHandle: 'handle_f_sales' }
    ],
    'no_match',
    C5, fuY + 3150
  );

  const tagNoResponse = addTag('tag-no-response', 'Tag: No Response', 'No_Response', C5, fuY + 3450);


  // ═══════════════════════════════════════════════════════════════
  //  COLLECT ALL NODES
  // ═══════════════════════════════════════════════════════════════

  const nodes = [
    // Phase 1: Welcome
    trigger, tagMetaLead, sendWelcome, waitSystem, condSystem,
    // Phase 2: System branches
    tagExcel, sendPainExcel,
    tagDiary, sendPainDiary,
    tagCrm, sendCrmAsk, waitCrm, sendCrmResp,
    tagNothing, sendPainNothing,
    // Phase 3: Volume
    sendVolume, waitVolume, condVolume,
    // Phase 4: Volume responses
    tagV0, sendV0,
    tagV20, sendV20,
    tagV50, sendV50,
    tagV100, sendV100,
    // Phase 5: Social proof & trial
    sendSocialProof, sendTrialOffer, waitTrial, condTrial,
    // Phase 6: CTA branches
    tagTrial, sendTrialActivate, ctaActivate,
    tagDemo, sendDemo, ctaDemo,
    tagSales, sendSalesOptions, waitSales, condSales,
    sendSalesCall, sendSalesWa, sendSalesSchedule,
    sendQuestion,
    // Phase 7: Follow-up
    tagFollowup,
    sendR1, waitR1, condR1,
    sendR2, waitR2, condR2,
    sendR3, waitR3, condR3,
    sendFinal, waitFinal, condFinal,
    tagNoResponse
  ];


  // ═══════════════════════════════════════════════════════════════
  //  CONNECTIONS
  // ═══════════════════════════════════════════════════════════════

  const connections = [
    // ── Phase 1: Welcome chain ──
    conn('trigger-main', 'add_tag-tag-meta-lead'),
    conn('add_tag-tag-meta-lead', 'send_message-send-welcome'),
    conn('send_message-send-welcome', 'wait_for_reply-wait-system'),
    conn('wait_for_reply-wait-system', 'condition-cond-system'),

    // ── Phase 2: System branches from condition ──
    conn('condition-cond-system', 'add_tag-tag-excel', 'handle_excel'),
    conn('condition-cond-system', 'add_tag-tag-diary', 'handle_diary'),
    conn('condition-cond-system', 'add_tag-tag-crm', 'handle_crm'),
    conn('condition-cond-system', 'add_tag-tag-nothing', 'handle_nothing'),
    conn('condition-cond-system', 'send_message-send-volume', 'no_match'),  // fallback → skip to volume

    // Excel → pain → volume
    conn('add_tag-tag-excel', 'send_message-send-pain-excel'),
    conn('send_message-send-pain-excel', 'send_message-send-volume'),

    // Diary → pain → volume
    conn('add_tag-tag-diary', 'send_message-send-pain-diary'),
    conn('send_message-send-pain-diary', 'send_message-send-volume'),

    // CRM → ask → wait → resp → volume
    conn('add_tag-tag-crm', 'send_message-send-crm-ask'),
    conn('send_message-send-crm-ask', 'wait_for_reply-wait-crm'),
    conn('wait_for_reply-wait-crm', 'send_message-send-crm-resp'),
    conn('send_message-send-crm-resp', 'send_message-send-volume'),

    // Nothing → pain → volume
    conn('add_tag-tag-nothing', 'send_message-send-pain-nothing'),
    conn('send_message-send-pain-nothing', 'send_message-send-volume'),

    // ── Phase 3: Volume chain ──
    conn('send_message-send-volume', 'wait_for_reply-wait-volume'),
    conn('wait_for_reply-wait-volume', 'condition-cond-volume'),

    // ── Phase 4: Volume branches ──
    conn('condition-cond-volume', 'add_tag-tag-vol-0-20', 'handle_v0'),
    conn('condition-cond-volume', 'add_tag-tag-vol-20-50', 'handle_v20'),
    conn('condition-cond-volume', 'add_tag-tag-vol-50-100', 'handle_v50'),
    conn('condition-cond-volume', 'add_tag-tag-vol-100-plus', 'handle_v100'),
    conn('condition-cond-volume', 'send_message-send-social-proof', 'no_match'),  // fallback

    // Volume responses → social proof
    conn('add_tag-tag-vol-0-20', 'send_message-send-vol-0-20'),
    conn('send_message-send-vol-0-20', 'send_message-send-social-proof'),

    conn('add_tag-tag-vol-20-50', 'send_message-send-vol-20-50'),
    conn('send_message-send-vol-20-50', 'send_message-send-social-proof'),

    conn('add_tag-tag-vol-50-100', 'send_message-send-vol-50-100'),
    conn('send_message-send-vol-50-100', 'send_message-send-social-proof'),

    conn('add_tag-tag-vol-100-plus', 'send_message-send-vol-100-plus'),
    conn('send_message-send-vol-100-plus', 'send_message-send-social-proof'),

    // ── Phase 5: Social proof → Trial offer ──
    conn('send_message-send-social-proof', 'send_message-send-trial-offer'),
    conn('send_message-send-trial-offer', 'wait_for_reply-wait-trial'),
    conn('wait_for_reply-wait-trial', 'condition-cond-trial'),

    // ── Phase 6: Trial choice branches ──
    conn('condition-cond-trial', 'add_tag-tag-trial', 'handle_trial'),
    conn('condition-cond-trial', 'add_tag-tag-demo', 'handle_demo'),
    conn('condition-cond-trial', 'add_tag-tag-sales', 'handle_sales'),
    conn('condition-cond-trial', 'send_message-send-question', 'handle_question'),
    conn('condition-cond-trial', 'add_tag-tag-followup', 'no_match'),   // timeout/no-match → follow-up

    // Trial → activate → CTA
    conn('add_tag-tag-trial', 'send_message-send-trial-activate'),
    conn('send_message-send-trial-activate', 'cta_button-cta-activate'),

    // Demo → booking → CTA
    conn('add_tag-tag-demo', 'send_message-send-demo'),
    conn('send_message-send-demo', 'cta_button-cta-demo'),

    // Sales → options → wait → route
    conn('add_tag-tag-sales', 'send_message-send-sales'),
    conn('send_message-send-sales', 'wait_for_reply-wait-sales'),
    conn('wait_for_reply-wait-sales', 'condition-cond-sales'),
    conn('condition-cond-sales', 'send_message-send-sales-call', 'handle_s_call'),
    conn('condition-cond-sales', 'send_message-send-sales-wa', 'handle_s_wa'),
    conn('condition-cond-sales', 'send_message-send-sales-schedule', 'no_match'),

    // ── Phase 7: Follow-up sequence ──
    conn('add_tag-tag-followup', 'send_message-send-reminder-1'),
    conn('send_message-send-reminder-1', 'wait_for_reply-wait-r1'),
    conn('wait_for_reply-wait-r1', 'condition-cond-r1'),

    // R1: Yes → trial, else → R2
    conn('condition-cond-r1', 'add_tag-tag-trial', 'handle_r1_yes'),
    conn('condition-cond-r1', 'send_message-send-reminder-2', 'no_match'),

    conn('send_message-send-reminder-2', 'wait_for_reply-wait-r2'),
    conn('wait_for_reply-wait-r2', 'condition-cond-r2'),

    // R2: Trial/Sales, else → R3
    conn('condition-cond-r2', 'add_tag-tag-trial', 'handle_r2_trial'),
    conn('condition-cond-r2', 'add_tag-tag-sales', 'handle_r2_sales'),
    conn('condition-cond-r2', 'send_message-send-reminder-3', 'no_match'),

    conn('send_message-send-reminder-3', 'wait_for_reply-wait-r3'),
    conn('wait_for_reply-wait-r3', 'condition-cond-r3'),

    // R3: Trial/Demo, else → Final
    conn('condition-cond-r3', 'add_tag-tag-trial', 'handle_r3_trial'),
    conn('condition-cond-r3', 'add_tag-tag-demo', 'handle_r3_demo'),
    conn('condition-cond-r3', 'send_message-send-final-reminder', 'no_match'),

    conn('send_message-send-final-reminder', 'wait_for_reply-wait-final'),
    conn('wait_for_reply-wait-final', 'condition-cond-final'),

    // Final: Trial/Sales, else → tag no response
    conn('condition-cond-final', 'add_tag-tag-trial', 'handle_f_trial'),
    conn('condition-cond-final', 'add_tag-tag-sales', 'handle_f_sales'),
    conn('condition-cond-final', 'add_tag-tag-no-response', 'no_match'),
  ];


  // ═══════════════════════════════════════════════════════════════
  //  LEAD SCORING RULES
  // ═══════════════════════════════════════════════════════════════

  const lead_scoring_rules = {
    'Meta_Lead': 5,
    'Using_Excel': 3,
    'Using_Diary': 3,
    'Using_CRM': 2,
    'No_System': 4,
    'Renewals_0_20': 2,
    'Renewals_20_50': 5,
    'Renewals_50_100': 8,
    'Renewals_100Plus': 10,
    'Trial_Clicked': 15,
    'Demo_Booked': 12,
    'Sales_Interested': 10,
    'Price_Concern': 3,
    'Need_Followup': 1,
    'No_Response': -5,
  };


  // ═══════════════════════════════════════════════════════════════
  //  ASSEMBLE THE FLOW DOCUMENT
  // ═══════════════════════════════════════════════════════════════

  return {
    name: 'Insurance Desk — Meta Ad → WhatsApp Funnel',
    description:
      'Complete lead qualification flow for Insurance Desk. Converts Meta Ad (CTWA) ' +
      'clicks into 30-Day Free Trial sign-ups through progressive qualification, ' +
      'social proof, and automated follow-ups.',
    user_id: new mongoose.Types.ObjectId(userId),
    is_active: true,
    nodes,
    connections,
    triggers: [
      {
        event_type: 'message_received',
        conditions: {}   // matches all incoming messages
      }
    ],
    settings: {
      execution_timeout: 300000,   // 5 min per step
      max_executions: 10000,
      error_handling: 'continue',
      retry_attempts: 3
    },
    lead_scoring_rules,
    statistics: {
      total_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      average_execution_time: 0
    }
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node scripts/seed-insurance-desk-flow.js <userId>');
    process.exit(1);
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.error(`Invalid ObjectId: ${userId}`);
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.error('MONGODB_URI or DATABASE_URL not set in .env');
    process.exit(1);
  }

  console.log('─'.repeat(60));
  console.log(' Insurance Desk — Flow Seed Script');
  console.log('─'.repeat(60));

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // ── Import models ──
    const { default: Tag } = await import('../models/tag.model.js');
    const { default: AutomationFlow } = await import('../models/automation-flow.model.js');

    // ── Step 1: Ensure all tags exist ──
    console.log('\n📌 Creating tags...');
    for (const def of TAG_DEFS) {
      const existing = await Tag.findOne({
        label: def.label,
        created_by: userId,
        deleted_at: null
      });

      if (!existing) {
        await Tag.create({
          label: def.label,
          color: def.color,
          created_by: userId
        });
        console.log(`  + Created tag: ${def.label}`);
      } else {
        console.log(`  ○ Tag exists: ${def.label}`);
      }
    }

    // ── Step 2: Check for existing flow ──
    const existingFlow = await AutomationFlow.findOne({
      user_id: userId,
      name: 'Insurance Desk — Meta Ad → WhatsApp Funnel',
      deleted_at: null
    });

    if (existingFlow) {
      console.log(`\n⚠️  Flow already exists (ID: ${existingFlow._id})`);
      console.log('   To recreate, delete the existing flow first.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ── Step 3: Build & insert the flow ──
    console.log('\n🔧 Building automation flow...');
    const flowData = buildFlow(userId);
    console.log(`   Nodes: ${flowData.nodes.length}`);
    console.log(`   Connections: ${flowData.connections.length}`);

    const flow = await AutomationFlow.create(flowData);
    console.log(`\n✅ Flow created successfully!`);
    console.log(`   ID: ${flow._id}`);
    console.log(`   Name: ${flow.name}`);

    // ── Step 4: Clear automation cache ──
    try {
      const { default: automationCache } = await import('../utils/automation-cache.js');
      automationCache.clearUserCache(userId);
      console.log('   Cache cleared for user');
    } catch (e) {
      console.log('   ⚠️ Could not clear cache (non-critical):', e.message);
    }

    // ── Summary ──
    console.log('\n' + '─'.repeat(60));
    console.log(' ✅ DONE!');
    console.log('─'.repeat(60));
    console.log(`\n Flow ID:    ${flow._id}`);
    console.log(` Nodes:      ${flowData.nodes.length}`);
    console.log(` Connections: ${flowData.connections.length}`);
    console.log(` Tags:       ${TAG_DEFS.length}`);
    console.log(` Trigger:    message_received (all messages)`);
    console.log(`\n Placeholder URLs to update:`);
    console.log(`   Trial:  ${TRIAL_URL}`);
    console.log(`   Demo:   ${DEMO_URL}`);
    console.log(`   Sales:  ${SALES_PHONE}`);
    console.log(`   Video:  ${DEMO_VIDEO}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
