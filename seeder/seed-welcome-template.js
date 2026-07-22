/**
 * Seed the "welcome_template" WhatsApp template for a specific user.
 *
 * Used by Insurance Desk Funnel 1 (Day 0, step 6 → send_template). The
 * automation engine looks up the template by lowercased template_name and
 * requires status === 'approved', matching the flow owner's user_id (or an
 * admin template). This creates an approved template owned by the given user.
 *
 * Usage:
 *   node seeder/seed-welcome-template.js --email=demo@chatwave.in
 *   node seeder/seed-welcome-template.js --userId=<USER_OBJECT_ID>
 */
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
const emailArg = args.find(a => a.startsWith('--email='));
const userIdArg = args.find(a => a.startsWith('--userId='));
const email = emailArg ? emailArg.split('=')[1] : 'demo@chatwave.in';
const userIdOverride = userIdArg ? userIdArg.split('=')[1] : null;

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/chatwave';

async function main() {
  console.log('🚀 welcome_template Seeder');
  console.log('==========================');
  console.log(`📦 MongoDB: ${MONGO_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log(userIdOverride ? `👤 User ID: ${userIdOverride}` : `👤 User email: ${email}`);
  console.log('');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const { default: User } = await import('../models/user.model.js');
  const { default: Template } = await import('../models/template.model.js');

  let userId = userIdOverride;
  if (!userId) {
    const user = await User.findOne({ email, deleted_at: null });
    if (!user) {
      console.error(`❌ No user found with email "${email}". Pass --userId=<id> or check the email.`);
      await mongoose.disconnect();
      process.exit(1);
    }
    userId = user._id;
    console.log(`✅ Found user "${user.name || email}" (${userId})`);
  }

  const templateData = {
    user_id: userId,
    created_by: userId,
    template_name: 'welcome_template',
    language: 'en_US',
    category: 'MARKETING',
    template_type: 'standard',
    status: 'approved',
    is_admin_template: false,
    parameter_format: 'positional',
    header: { format: 'none' },
    message_body:
      "Hi {{1}}, thanks for your interest in Insurance Desk! 🎯\n" +
      "We help insurance agents like you manage renewals, leads and clients — all from one dashboard.\n" +
      "Here's a 90-second look at how it works 👇",
    body_variables: [{ key: '1', example: 'Rahul' }],
    footer_text: 'Insurance Desk'
  };

  // Upsert by (template_name, user_id, language) so re-runs don't duplicate.
  const existing = await Template.findOne({
    template_name: 'welcome_template',
    user_id: userId,
    language: 'en_US',
    deleted_at: null
  });

  if (existing) {
    await Template.updateOne({ _id: existing._id }, { $set: templateData });
    console.log(`♻️  Updated existing "welcome_template" (${existing._id}) → status=approved`);
  } else {
    const created = await Template.create(templateData);
    console.log(`✅ Created "welcome_template" (${created._id}) for user ${userId}`);
  }

  console.log('');
  console.log('✅ Done. The Funnel 1 send_template (Day 0, step 6) can now resolve "welcome_template".');
  console.log('   Note: actually delivering it over WhatsApp still requires an approved template on your');
  console.log('   connected WABA in Meta. This record satisfies the engine lookup + approved-status check.');

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

main().catch(err => {
  console.error('❌ Seeder failed:', err.message);
  process.exit(1);
});
