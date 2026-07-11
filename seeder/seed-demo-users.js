import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/config.js';

const env = process.env.NODE_ENV || 'development';
const envConfig = config[env];
const mongoUri = process.env.MONGODB_URI || envConfig.mongoUri;

async function createDemoUser() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const User = (await import('../models/user.model.js')).default;
  const Role = (await import('../models/role.model.js')).default;

  // Get the "user" role
  const userRole = await Role.findOne({ name: 'user' });
  if (!userRole) {
    console.error('Role "user" not found! Run npm run seed first.');
    process.exit(1);
  }

  // Get the "agent" role
  const agentRole = await Role.findOne({ name: 'agent' });

  // Demo User
  const demoUserEmail = 'user@chatwave.com';
  const existingUser = await User.findOne({ email: demoUserEmail, deleted_at: null });
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash('User@123', 10);
    await User.create({
      name: 'Demo User',
      email: demoUserEmail,
      password: hashedPassword,
      role_id: userRole._id,
      email_verified: true
    });
    console.log('Demo User created! (user@chatwave.com / User@123)');
  } else {
    // Update to ensure email_verified is true
    await User.updateOne({ _id: existingUser._id }, { email_verified: true });
    console.log('Demo User already exists, ensured email_verified=true');
  }

  // Demo Agent
  if (agentRole) {
    const demoAgentEmail = 'agent@chatwave.com';
    const existingAgent = await User.findOne({ email: demoAgentEmail, deleted_at: null });
    if (!existingAgent) {
      const hashedPassword = await bcrypt.hash('Agent@123', 10);
      await User.create({
        name: 'Demo Agent',
        email: demoAgentEmail,
        password: hashedPassword,
        role_id: agentRole._id,
        email_verified: true
      });
      console.log('Demo Agent created! (agent@chatwave.com / Agent@123)');
    } else {
      await User.updateOne({ _id: existingAgent._id }, { email_verified: true });
      console.log('Demo Agent already exists, ensured email_verified=true');
    }
  }

  // Also ensure the admin user has email_verified = true
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@chatwave.com';
  await User.updateOne({ email: adminEmail, deleted_at: null }, { email_verified: true });
  console.log(`Admin (${adminEmail}) email_verified set to true`);

  await mongoose.disconnect();
  console.log('Done!');
}

createDemoUser().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
