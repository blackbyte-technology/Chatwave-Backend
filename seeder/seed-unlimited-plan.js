import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../config/config.js';

const env = process.env.NODE_ENV || 'development';
const envConfig = config[env];
const mongoUri = process.env.MONGODB_URI || envConfig.mongoUri;

async function seedUnlimitedPlan() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const Plan = (await import('../models/plan.model.js')).default;
  const Subscription = (await import('../models/subscription.model.js')).default;
  const User = (await import('../models/user.model.js')).default;
  const Currency = (await import('../models/currency.model.js')).default;

  // Get default currency (USD)
  let currency = await Currency.findOne({ is_default: true, deleted_at: null });
  if (!currency) {
    currency = await Currency.findOne({ deleted_at: null });
  }
  if (!currency) {
    console.error('No currency found! Run npm run seed first.');
    process.exit(1);
  }
  console.log(`Using currency: ${currency.name} (${currency.code})`);

  // Create Unlimited Plan
  const planData = {
    name: 'Unlimited',
    slug: 'unlimited',
    description: 'Full access to all features with unlimited usage',
    price: 0,
    currency: currency._id,
    billing_cycle: 'lifetime',
    trial_days: 0,
    is_featured: true,
    is_active: true,
    sort_order: 0,
    features: {
      contacts: 999999,
      template_bots: 999999,
      message_bots: 999999,
      campaigns: 999999,
      ai_prompts: 999999,
      staff: 999999,
      conversations: 999999,
      bot_flow: 999999,
      rest_api: true,
      whatsapp_webhook: true,
      auto_replies: true,
      analytics: true,
      priority_support: true,
      custom_fields: 999999,
      tags: 999999,
      teams: 999999,
      forms: 999999,
      whatsapp_calling: 999999,
      appointment_bookings: 999999,
      facebookAds_campaign: 999999,
      kanban_funnels: 999999,
      segments: 999999
    }
  };

  const plan = await Plan.findOneAndUpdate(
    { slug: 'unlimited' },
    planData,
    { upsert: true, returnDocument: 'after' }
  );
  console.log(`Plan "${plan.name}" created/updated!`);

  // Find demo user
  const demoUser = await User.findOne({ email: 'user@chatwave.com', deleted_at: null });
  if (!demoUser) {
    console.error('Demo user (user@chatwave.com) not found! Run seed-demo-users.js first.');
    process.exit(1);
  }

  // Create/update subscription for demo user
  const farFuture = new Date('2099-12-31');
  const now = new Date();

  const subscriptionData = {
    user_id: demoUser._id,
    plan_id: plan._id,
    status: 'active',
    started_at: now,
    current_period_start: now,
    current_period_end: farFuture,
    expires_at: farFuture,
    payment_gateway: 'admin generated',
    payment_method: 'free',
    payment_status: 'paid'
  };

  await Subscription.findOneAndUpdate(
    { user_id: demoUser._id },
    subscriptionData,
    { upsert: true, returnDocument: 'after' }
  );
  console.log(`Unlimited subscription assigned to user@chatwave.com (expires: 2099-12-31)`);

  await mongoose.disconnect();
  console.log('Done!');
}

seedUnlimitedPlan().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
