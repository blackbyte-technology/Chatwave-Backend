import mongoose from 'mongoose';
import 'dotenv/config';
import Plan from '../models/plan.model.js';
import Subscription from '../models/subscription.model.js';
import User from '../models/user.model.js';
import Currency from '../models/currency.model.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function seedPlanAndAssign() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Get INR currency
    let currency = await Currency.findOne({ code: 'INR' });
    if (!currency) {
      currency = await Currency.findOne({});
      if (!currency) {
        console.error('No currency found! Run npm run seed first.');
        process.exit(1);
      }
    }
    console.log(`Using currency: ${currency.code} (${currency._id})`);

    // 2. Create the "Starter" Plan (or find existing)
    const planSlug = 'starter';
    let plan = await Plan.findOne({ slug: planSlug, deleted_at: null });

    if (!plan) {
      plan = await Plan.create({
        name: 'Starter',
        slug: planSlug,
        description: 'Perfect for small businesses getting started with WhatsApp Business API. Includes all essential features to manage chats, send campaigns, and grow your business.',
        price: 0,
        currency: currency._id,
        billing_cycle: 'free Trial',
        trial_days: 30,
        is_featured: true,
        is_active: true,
        sort_order: 1,
        features: {
          contacts: 1000,
          template_bots: 10,
          message_bots: 5,
          campaigns: 10,
          ai_prompts: 100,
          staff: 3,
          conversations: 500,
          bot_flow: 5,
          rest_api: true,
          whatsapp_webhook: true,
          auto_replies: true,
          analytics: true,
          priority_support: false,
          custom_fields: 10,
          tags: 20,
          teams: 2,
          forms: 5,
          whatsapp_calling: 0,
          appointment_bookings: 10,
          facebookAds_campaign: 2,
          kanban_funnels: 3,
          segments: 5
        }
      });
      console.log(`✅ Plan "${plan.name}" created! (ID: ${plan._id})`);
    } else {
      console.log(`Plan "${plan.name}" already exists. (ID: ${plan._id})`);
    }

    // 3. Find demo user
    const demoUser = await User.findOne({ email: 'user@chatwave.com', deleted_at: null });
    if (!demoUser) {
      console.error('❌ Demo user (user@chatwave.com) not found! Run seed-demo-users.js first.');
      process.exit(1);
    }
    console.log(`Found user: ${demoUser.name} (${demoUser.email})`);

    // 4. Check if user already has an active subscription
    const existingSub = await Subscription.findOne({
      user_id: demoUser._id,
      status: { $in: ['active', 'trial'] },
      deleted_at: null
    });

    if (existingSub) {
      console.log(`User already has an active subscription (ID: ${existingSub._id}, Status: ${existingSub.status})`);
    } else {
      // 5. Create subscription for the user
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + plan.trial_days);

      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 365); // 1 year

      const subscription = await Subscription.create({
        user_id: demoUser._id,
        plan_id: plan._id,
        status: 'active',
        started_at: now,
        trial_ends_at: trialEnd,
        current_period_start: now,
        current_period_end: periodEnd,
        expires_at: periodEnd,
        payment_gateway: 'manual',
        payment_method: 'manual',
        payment_status: 'paid',
        amount_paid: 0,
        currency: currency.code || 'INR',
        auto_renew: true,
        notes: 'Demo subscription - auto-assigned by seeder',
        features: plan.features,
        duration: 12
      });

      console.log(`✅ Subscription created for ${demoUser.email}!`);
      console.log(`   Plan: ${plan.name}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Valid until: ${periodEnd.toDateString()}`);
      console.log(`   Subscription ID: ${subscription._id}`);
    }

    // 6. Also assign to agent user if exists
    const agentUser = await User.findOne({ email: 'agent@chatwave.com', deleted_at: null });
    if (agentUser) {
      const agentSub = await Subscription.findOne({
        user_id: agentUser._id,
        status: { $in: ['active', 'trial'] },
        deleted_at: null
      });

      if (!agentSub) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 365);

        await Subscription.create({
          user_id: agentUser._id,
          plan_id: plan._id,
          status: 'active',
          started_at: now,
          current_period_start: now,
          current_period_end: periodEnd,
          expires_at: periodEnd,
          payment_gateway: 'manual',
          payment_method: 'manual',
          payment_status: 'paid',
          amount_paid: 0,
          currency: currency.code || 'INR',
          auto_renew: true,
          notes: 'Demo subscription - auto-assigned by seeder',
          features: plan.features,
          duration: 12
        });
        console.log(`✅ Subscription also assigned to ${agentUser.email}!`);
      } else {
        console.log(`Agent already has subscription.`);
      }
    }

    console.log('\n🎉 Done! Plan created and assigned to demo users.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seedPlanAndAssign();
