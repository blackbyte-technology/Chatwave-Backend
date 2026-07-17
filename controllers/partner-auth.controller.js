import bcrypt from 'bcryptjs';
import { User, Role, Setting, Plan, Subscription } from '../models/index.js';

const BCRYPT_SALT_ROUNDS = 10;

export const partnerRegister = async (req, res) => {
  const { name, email, phone, countryCode, password, agentId } = req.body;

  if (!name || !email || !phone || !countryCode || !password || !agentId) {
    return res.status(400).json({ message: 'All fields including agentId are required.' });
  }

  try {
    const role = await Role.findOne({ name: 'user' });
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role not found'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingEmail = await User.findOne({ email: normalizedEmail, deleted_at: null });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const existingPhone = await User.findOne({ country_code: countryCode, phone, deleted_at: null });
    if (existingPhone) return res.status(409).json({ message: 'Phone number already registered' });

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const settings = await Setting.findOne().sort({ created_at: -1 });
    const globalStorageLimitMB = settings?.storage_limit || 100;

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      country_code: countryCode,
      phone,
      role_id: role._id,
      password: hashedPassword,
      storage_limit: globalStorageLimitMB,
      is_verified: true, // Auto-verified for partners
      phone_verified: true,
      integration_source: 'insurancedesk',
      integration_ref_id: agentId
    });

    // Auto-assign the partner plan
    const partnerPlan = await Plan.findOne({ slug: 'insurancedesk-partner-plan', deleted_at: null });
    if (partnerPlan) {
      const now = new Date();
      // lifetime subscription
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 100);

      await Subscription.create({
        user_id: newUser._id,
        plan_id: partnerPlan._id,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
        started_at: now,
        features: partnerPlan.features,
        payment_gateway: 'manual',
        payment_status: 'paid',
        auto_renew: true
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Partner registered successfully',
      data: {
        user_id: newUser._id,
        redirect: '/workspace/create'
      }
    });
  } catch (error) {
    console.error('Partner registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register partner',
      error: error.message
    });
  }
};
