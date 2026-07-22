/**
 * Seed Insurance Desk Funnel 1 – Meta Lead → Trial Activation
 * 
 * Usage:
 *   node seeder/seed-insurance-funnel.js --userId=<USER_OBJECT_ID>
 * 
 * This script:
 * 1. Creates all required tags (if not existing)
 * 2. Creates the automation flow from the JSON template
 * 3. Activates the flow
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from parent directory (Chatwave-Backend)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Parse CLI args
const args = process.argv.slice(2);
const userIdArg = args.find(a => a.startsWith('--userId='));
const userId = userIdArg ? userIdArg.split('=')[1] : null;

if (!userId) {
  console.error('❌ Usage: node seeder/seed-insurance-funnel.js --userId=<USER_OBJECT_ID>');
  process.exit(1);
}

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/chatwave';

async function main() {
  console.log('🚀 Insurance Desk Funnel 1 Seeder');
  console.log('================================');
  console.log(`📦 MongoDB URI: ${MONGO_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log(`👤 User ID: ${userId}`);
  console.log('');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Import models
  const { default: AutomationFlow } = await import('../models/automation-flow.model.js');
  const { default: Tag } = await import('../models/tag.model.js');

  // Step 1: Load funnel JSON
  const funnelPath = path.join(__dirname, 'insurance-desk-funnel-1.json');
  const funnelData = JSON.parse(fs.readFileSync(funnelPath, 'utf-8'));
  console.log(`📄 Loaded funnel template: "${funnelData.name}"`);
  console.log(`   ${funnelData.nodes.length} nodes, ${funnelData.connections.length} connections`);
  console.log('');

  // Step 2: Create required tags
  console.log('🏷️  Creating tags...');
  const tagsRequired = funnelData.tags_required || [];

  const tagColors = {
    META_LEAD: '#6366f1',
    STAGE_DAY0: '#94a3b8',
    STAGE_DAY1: '#94a3b8',
    STAGE_DAY2: '#94a3b8',
    STAGE_DAY3: '#94a3b8',
    STAGE_DAY4: '#94a3b8',
    STAGE_DAY5: '#94a3b8',
    STAGE_FUNNEL2: '#0ea5e9',
    TRIAL_REQUEST: '#22d3ee',
    TRIAL_STARTED: '#06b6d4',
    BOOKED_DEMO: '#8b5cf6',
    WATCHED_DEMO: '#3b82f6',
    SALES_OWNED: '#a855f7',
    PAIN_ACKNOWLEDGED: '#eab308',
    NO_REPLY_DAY1: '#9ca3af',
    AI_INTEREST: '#f97316',
    RENEWAL_INTEREST: '#14b8a6',
    APP_INTEREST: '#ec4899',
    CRM_INTEREST: '#84cc16',
    OBJECTION_COST: '#f43f5e',
    OBJECTION_TIME: '#fb923c',
    OBJECTION_VALUE: '#e879f9',
    HOT_LEAD: '#22c55e',
    WARM_LEAD: '#f59e0b',
    COLD_LEAD: '#ef4444'
  };

  let tagsCreated = 0;
  let tagsExisted = 0;

  for (const tagLabel of tagsRequired) {
    const existing = await Tag.findOne({ label: tagLabel, created_by: userId, deleted_at: null });
    if (existing) {
      tagsExisted++;
      console.log(`   ⏩ Tag "${tagLabel}" already exists`);
    } else {
      await Tag.create({
        label: tagLabel,
        color: tagColors[tagLabel] || '#007bff',
        created_by: userId
      });
      tagsCreated++;
      console.log(`   ✅ Created tag "${tagLabel}"`);
    }
  }

  console.log(`   📊 Tags: ${tagsCreated} created, ${tagsExisted} already existed`);
  console.log('');

  // Step 3: Check for existing funnel
  const existingFlow = await AutomationFlow.findOne({
    name: funnelData.name,
    user_id: userId,
    deleted_at: null
  });

  if (existingFlow) {
    console.log(`⚠️  Funnel "${funnelData.name}" already exists (ID: ${existingFlow._id})`);
    console.log('   Updating existing flow...');

    existingFlow.nodes = funnelData.nodes;
    existingFlow.connections = funnelData.connections;
    existingFlow.triggers = funnelData.triggers;
    existingFlow.settings = funnelData.settings;
    existingFlow.lead_scoring_rules = funnelData.lead_scoring_rules || {};
    existingFlow.description = funnelData.description;
    existingFlow.is_active = true;
    existingFlow.markModified('lead_scoring_rules');
    await existingFlow.save();

    console.log(`   ✅ Flow updated successfully`);
    console.log(`   🔗 Flow ID: ${existingFlow._id}`);
  } else {
    // Step 4: Create automation flow
    console.log('🔄 Creating automation flow...');

    const flow = await AutomationFlow.create({
      name: funnelData.name,
      description: funnelData.description,
      user_id: userId,
      is_active: true,
      is_public: false,
      nodes: funnelData.nodes,
      connections: funnelData.connections,
      triggers: funnelData.triggers,
      settings: funnelData.settings,
      lead_scoring_rules: funnelData.lead_scoring_rules || {}
    });

    console.log(`   ✅ Flow created successfully`);
    console.log(`   🔗 Flow ID: ${flow._id}`);
  }

  console.log('');
  console.log('================================');
  console.log('✅ Insurance Desk Funnel 1 seeded successfully!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Configure your Meta ad Click-to-WhatsApp automation trigger');
  console.log('   2. Update the YouTube demo playlist URL in the flow');
  console.log('   3. Set up webhook URL for sales team notifications');
  console.log('   4. Test the flow with a test contact');
  console.log('');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

main().catch(err => {
  console.error('❌ Seeder failed:', err.message);
  process.exit(1);
});
