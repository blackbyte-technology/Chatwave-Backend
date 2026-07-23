import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://blackbytetechnology_db_user:he5w33KeELD4aDDf@chatwave.22ztnsl.mongodb.net/chatwave';
const FLOW_ID = '6a6264f82c44e3d046f35b3a';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // 1. Clean up ALL stuck running executions for this flow
  const cleanResult = await db.collection('automation_executions').updateMany(
    { flow_id: new mongoose.Types.ObjectId(FLOW_ID), status: 'running' },
    { $set: { status: 'failed', error: 'Cleaned up stuck execution (pre-deploy)', completed_at: new Date() } }
  );
  console.log('Cleaned stuck executions:', cleanResult.modifiedCount);

  // 2. Also clean any old failed ones older than 1 hour for this flow
  // so cooldown doesn't block new attempts
  const oldClean = await db.collection('automation_executions').updateMany(
    {
      flow_id: new mongoose.Types.ObjectId(FLOW_ID),
      status: 'failed',
      created_at: { $lt: new Date(Date.now() - 60 * 60 * 1000) }
    },
    { $set: { status: 'cancelled' } }
  );
  console.log('Marked old failed as cancelled:', oldClean.modifiedCount);

  // 3. Show current state
  const remaining = await db.collection('automation_executions').find({
    flow_id: new mongoose.Types.ObjectId(FLOW_ID),
    status: { $in: ['running', 'waiting'] }
  }).toArray();
  console.log('\nActive executions remaining:', remaining.length);

  await mongoose.disconnect();
  console.log('\n✅ Cleaned. Flow is ready to trigger again.');
}

main().catch(e => { console.error(e); process.exit(1); });
