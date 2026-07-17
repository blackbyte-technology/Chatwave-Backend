import mongoose from 'mongoose';
import 'dotenv/config';
import Plan from '../models/plan.model.js';
import Currency from '../models/currency.model.js';
import User from '../models/user.model.js';

export default async function seedPartnerPlan() {
  console.log('Starting seedPartnerPlan...');
  try {
    // 1. Get INR currency
    let currency = await Currency.findOne({ code: 'INR' });
    if (!currency) {
      currency = await Currency.findOne({});
      if (!currency) {
        console.error('No currency found! Ensure currencies are seeded.');
        return;
      }
    }
    console.log(`Using currency: ${currency.code} (${currency._id})`);

    // 2. Fetch admin user to attribute creation
    const adminUser = await User.findOne({ email: 'admin@chatwave.com', deleted_at: null });
    const creatorName = adminUser ? adminUser.name : 'Admin';

    // 3. Create the "InsuranceDesk Partner" Plan
    const planSlug = 'insurancedesk-partner-plan';
    let plan = await Plan.findOne({ slug: planSlug, deleted_at: null });

    if (!plan) {
      plan = await Plan.create({
        name: 'InsuranceDesk Partner',
        slug: planSlug,
        description: `Dedicated plan for InsuranceDesk CRM integration. Created by ${creatorName}.`,
        price: 0,
        currency: currency._id,
        billing_cycle: 'lifetime',
        trial_days: 0,
        is_featured: false,
        is_active: true,
        sort_order: 10,
        features: {
          contacts: 10000,
          template_bots: 50,
          message_bots: 20,
          campaigns: 100,
          ai_prompts: 500,
          staff: 1, // 1 staff per agent
          conversations: 10000,
          bot_flow: 10,
          rest_api: true,
          whatsapp_webhook: true,
          auto_replies: true,
          analytics: true,
          priority_support: false,
          custom_fields: 50,
          tags: 50,
          teams: 0,
          forms: 0,
          whatsapp_calling: 0,
          appointment_bookings: 0,
          facebookAds_campaign: 0,
          kanban_funnels: 0,
          segments: 10
        }
      });
      console.log(`✅ Plan "${plan.name}" created! (ID: ${plan._id})`);
    } else {
      console.log(`Plan "${plan.name}" already exists. (ID: ${plan._id})`);
    }

    console.log('\n🎉 Done! InsuranceDesk Partner plan created.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}
