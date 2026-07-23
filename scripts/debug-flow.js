import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://blackbytetechnology_db_user:he5w33KeELD4aDDf@chatwave.22ztnsl.mongodb.net/chatwave';
const FLOW_ID = '6a6264f82c44e3d046f35b3a';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // Get latest executions
  const execs = await db.collection('automation_executions').find({
    flow_id: new mongoose.Types.ObjectId(FLOW_ID)
  }).sort({ created_at: -1 }).limit(5).toArray();

  console.log('=== LATEST EXECUTIONS ===');
  for (const e of execs) {
    console.log(`\n--- Execution ${e._id} ---`);
    console.log(`Status: ${e.status}`);
    console.log(`Contact: ${e.contact_identifier}`);
    console.log(`Sender: ${e.input_data?.senderNumber}`);
    console.log(`Created: ${e.created_at}`);
    console.log(`Completed: ${e.completed_at || 'NOT COMPLETED'}`);
    console.log(`Error: ${e.error || 'none'}`);
    console.log(`Waiting for node: ${e.waiting_for_node_id || 'none'}`);
    console.log(`Next node: ${e.next_node_id || 'none'}`);
    
    // Show execution log
    const log = e.execution_log || [];
    console.log(`Execution log (${log.length} entries):`);
    log.forEach((l, i) => {
      console.log(`  [${i}] ${l.node_type}:${l.node_id} → ${l.status} ${l.error ? '| ERROR: ' + l.error : ''}`);
    });
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
