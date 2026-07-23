import mongoose from 'mongoose';
const MONGODB_URI = 'mongodb+srv://blackbytetechnology_db_user:he5w33KeELD4aDDf@chatwave.22ztnsl.mongodb.net/chatwave';

async function main() {
  await mongoose.connect(MONGODB_URI);
  
  // 1. Clean up stuck running executions
  const r = await mongoose.connection.db.collection('automation_executions').updateMany(
    { flow_id: new mongoose.Types.ObjectId('6a6264f82c44e3d046f35b3a'), status: 'running' },
    { $set: { status: 'failed', error: 'Cleaned up stuck execution', completed_at: new Date() } }
  );
  console.log('Cleaned up:', r.modifiedCount, 'stuck executions');

  // 2. Check what other flows have empty/null conditions (catch-all triggers)
  const flows = await mongoose.connection.db.collection('automation_flows').find({
    user_id: new mongoose.Types.ObjectId('6a562f748c9cbb731d23c626'),
    is_active: true,
    deleted_at: null
  }).toArray();
  
  console.log('\nActive flows:');
  for (const f of flows) {
    const triggers = f.triggers || [];
    const hasCatchAll = triggers.some(t => {
      if (t.event_type !== 'message_received') return false;
      const conds = t.conditions;
      return !conds || Object.keys(conds).length === 0;
    });
    console.log(`  ${f._id} | ${f.name} | catch-all: ${hasCatchAll}`);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
