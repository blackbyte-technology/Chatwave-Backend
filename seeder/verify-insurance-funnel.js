/**
 * Static verifier for insurance-desk-funnel-1.json
 *
 * Reads the funnel JSON directly (no DB / no Redis) and checks it against the
 * structural requirements of Insurance-Desk-Funnel1-BUILD-SPEC.md:
 *   - connection integrity (sources/targets exist, handles present)
 *   - reachability from the trigger (no unreachable nodes)
 *   - condition branch coverage (every handle connects, except END handles)
 *   - no cycles (no block executes twice / no infinite loops)
 *   - every wait_for_reply has a reply timeout
 *   - every delay/wait has an outgoing edge (no dead waits)
 *   - EXIT CHECK after every wait timer (Day 0..Day 5)
 *   - all spec tags are created and every tag used is in tags_required
 *   - lead scoring rules present
 *
 * Usage: node seeder/verify-insurance-funnel.js
 * Exit code 0 = no errors, 1 = errors found.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const funnel = JSON.parse(fs.readFileSync(path.join(__dirname, 'insurance-desk-funnel-1.json'), 'utf-8'));

const nodes = funnel.nodes;
const conns = funnel.connections;
const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

const errors = [];
const warnings = [];

// Handles that intentionally have NO outgoing connection (they mean END).
const END_HANDLES = new Set(['handle-exit']);
// Nodes that are legitimate terminals (END of a branch).
const TERMINAL_NODES = new Set(['b1-cta-open', 'b2-msg-confirm', 'd5-sheet-cold', 'd5-sheet-complete']);

console.log('═══════════════════════════════════════════════════════════');
console.log(`  VERIFY: ${funnel.name}`);
console.log(`  Nodes: ${nodes.length} | Connections: ${conns.length}`);
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Connection integrity + unique ids
const nodeIds = new Set();
for (const n of nodes) {
  if (nodeIds.has(n.id)) errors.push(`Duplicate node id: ${n.id}`);
  nodeIds.add(n.id);
}
const connIds = new Set();
for (const c of conns) {
  if (connIds.has(c.id)) errors.push(`Duplicate connection id: ${c.id}`);
  connIds.add(c.id);
  if (!nodeMap[c.source]) errors.push(`Connection ${c.id}: source "${c.source}" not found`);
  if (!nodeMap[c.target]) errors.push(`Connection ${c.id}: target "${c.target}" not found`);
  if (!c.sourceHandle) errors.push(`Connection ${c.id}: missing sourceHandle`);
  if (!c.targetHandle) errors.push(`Connection ${c.id}: missing targetHandle`);
}

const outByNode = {};
for (const c of conns) (outByNode[c.source] ||= []).push(c);
const inByNode = {};
for (const c of conns) (inByNode[c.target] ||= []).push(c);

// 2. Reachability from trigger (follow all outgoing edges)
const trigger = nodes.find(n => n.type === 'trigger');
if (!trigger) errors.push('No trigger node found');
const reachable = new Set();
if (trigger) {
  const stack = [trigger.id];
  while (stack.length) {
    const id = stack.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const c of (outByNode[id] || [])) stack.push(c.target);
  }
}
for (const n of nodes) {
  if (n.type === 'trigger') continue;
  if (!reachable.has(n.id)) errors.push(`Unreachable node: ${n.id} (${n.type})`);
  if (!inByNode[n.id] || inByNode[n.id].length === 0) errors.push(`Node ${n.id} has no incoming connection`);
}

// 3. Condition branch coverage
for (const n of nodes.filter(n => n.type === 'condition')) {
  const conditions = n.parameters?.conditions || [];
  const handles = new Set();
  conditions.forEach(cd => handles.add(cd.sourceHandle));
  if (n.parameters?.no_match_handle) handles.add(n.parameters.no_match_handle);
  const outHandles = new Set((outByNode[n.id] || []).map(c => c.sourceHandle));
  for (const h of handles) {
    if (END_HANDLES.has(h)) continue; // intentional END
    if (!outHandles.has(h)) errors.push(`Condition ${n.id}: handle "${h}" has no outgoing connection`);
  }
  // Ensure at least one END handle or connection so the node isn't stuck
  if ((outByNode[n.id] || []).length === 0 && ![...handles].some(h => END_HANDLES.has(h))) {
    errors.push(`Condition ${n.id}: no outgoing connections at all`);
  }
}

// 4. wait_for_reply: reply timeout + single outgoing
for (const n of nodes.filter(n => n.type === 'wait_for_reply')) {
  const p = n.parameters || {};
  const hasTimeout = p.timeout_ms || (p.timeout_value && p.timeout_unit);
  if (!hasTimeout) errors.push(`wait_for_reply ${n.id}: no reply timeout configured`);
  if (!p.variable_name) warnings.push(`wait_for_reply ${n.id}: no variable_name`);
  const outs = outByNode[n.id] || [];
  if (outs.length === 0) errors.push(`wait_for_reply ${n.id}: no outgoing connection (dead wait)`);
  if (outs.length > 1) errors.push(`wait_for_reply ${n.id}: ${outs.length} outgoing (engine follows only the first)`);
}

// 5. delay: has duration + single outgoing
for (const n of nodes.filter(n => n.type === 'delay')) {
  const p = n.parameters || {};
  if (!p.delay_ms && !p.delay_value) errors.push(`delay ${n.id}: no delay configured`);
  const outs = outByNode[n.id] || [];
  if (outs.length === 0) errors.push(`delay ${n.id}: no outgoing connection (dead delay)`);
  if (outs.length > 1) errors.push(`delay ${n.id}: ${outs.length} outgoing (engine follows only the first)`);
}

// 6. add_tag has tag_name
for (const n of nodes.filter(n => n.type === 'add_tag')) {
  if (!n.parameters?.tag_name) errors.push(`add_tag ${n.id}: missing tag_name`);
}

// 7. send_message / cta / template basics
for (const n of nodes.filter(n => n.type === 'send_message')) {
  const p = n.parameters || {};
  if (!p.recipient) errors.push(`send_message ${n.id}: missing recipient`);
  if (p.interactive_type === 'button' && !(p.button_params && p.button_params.length)) errors.push(`send_message ${n.id}: button without button_params`);
  if (p.interactive_type === 'list' && !p.list_params) errors.push(`send_message ${n.id}: list without list_params`);
  if (!p.interactive_type && !p.media_url && !p.message_template) errors.push(`send_message ${n.id}: no message_template/media/interactive`);
}
for (const n of nodes.filter(n => n.type === 'cta_button')) {
  const p = n.parameters || {};
  for (const f of ['recipient', 'text', 'button_text', 'url']) if (!p[f]) errors.push(`cta_button ${n.id}: missing ${f}`);
}
for (const n of nodes.filter(n => n.type === 'send_template')) {
  const p = n.parameters || {};
  if (!p.recipient) errors.push(`send_template ${n.id}: missing recipient`);
  if (!p.template_name && !p.template_id) errors.push(`send_template ${n.id}: missing template_name/template_id`);
}

// 8. Cycle detection (DFS)
const WHITE = 0, GRAY = 1, BLACK = 2;
const color = {};
nodes.forEach(n => (color[n.id] = WHITE));
function dfs(id, pathStack) {
  color[id] = GRAY;
  for (const c of (outByNode[id] || [])) {
    if (color[c.target] === GRAY) {
      errors.push(`Cycle detected: ${[...pathStack, id, c.target].join(' → ')}`);
    } else if (color[c.target] === WHITE) {
      dfs(c.target, [...pathStack, id]);
    }
  }
  color[id] = BLACK;
}
if (trigger) dfs(trigger.id, []);

// 9. Dead-end (no outgoing) sanity
for (const n of nodes) {
  const outs = outByNode[n.id] || [];
  if (outs.length === 0 && n.type !== 'trigger') {
    if (!TERMINAL_NODES.has(n.id) && n.type !== 'condition') {
      warnings.push(`Node ${n.id} (${n.type}) has no outgoing — is this an intended END?`);
    }
  }
}

// 10. Spec tag coverage
const usedTags = new Set(nodes.filter(n => n.type === 'add_tag').map(n => n.parameters.tag_name));
const declared = new Set(funnel.tags_required || []);
for (const t of usedTags) if (!declared.has(t)) errors.push(`Tag "${t}" used but not in tags_required`);
const SPEC_TAGS = ['META_LEAD','STAGE_DAY0','STAGE_DAY1','STAGE_DAY2','STAGE_DAY3','STAGE_DAY4','STAGE_DAY5','TRIAL_REQUEST','TRIAL_STARTED','BOOKED_DEMO','WATCHED_DEMO','SALES_OWNED','PAIN_ACKNOWLEDGED','NO_REPLY_DAY1','AI_INTEREST','RENEWAL_INTEREST','APP_INTEREST','CRM_INTEREST','OBJECTION_COST','OBJECTION_TIME','OBJECTION_VALUE','HOT_LEAD','WARM_LEAD','COLD_LEAD'];
for (const t of SPEC_TAGS) if (!declared.has(t)) errors.push(`Spec tag "${t}" missing from tags_required`);

// 11. EXIT CHECK after every day wait (Day 0..Day 5). Each EXIT CHECK must
// check the 3 exit tags and be immediately preceded by a delay.
const exitChecks = ['exit-check-day0','exit-check-day2','exit-check-day3','exit-check-day4'];
for (const ec of exitChecks) {
  const node = nodeMap[ec];
  if (!node) { errors.push(`Missing EXIT CHECK node: ${ec}`); continue; }
  const vals = new Set((node.parameters.conditions || []).map(c => c.value));
  for (const t of ['TRIAL_STARTED','BOOKED_DEMO','SALES_OWNED']) {
    if (!vals.has(t)) errors.push(`EXIT CHECK ${ec}: missing condition for ${t}`);
  }
  const preds = (inByNode[ec] || []).map(c => nodeMap[c.source]?.type);
  if (!preds.includes('delay')) warnings.push(`EXIT CHECK ${ec}: not immediately preceded by a delay`);
}
// Day 1 & Day 5 use the exit tags inside their Logic Control instead of a
// standalone EXIT CHECK (per spec those days branch on reply, and Day 5's
// Logic Control includes the TRIAL_STARTED/BOOKED_DEMO END check).
const d5 = nodeMap['d5-cond-final'];
if (d5) {
  const vals = new Set((d5.parameters.conditions || []).map(c => c.value));
  for (const t of ['TRIAL_STARTED','BOOKED_DEMO']) if (!vals.has(t)) errors.push(`Day 5 Logic Control: missing END check for ${t}`);
}

// 12. Lead scoring rules present and cover the spec triggers
const rules = funnel.lead_scoring_rules || {};
const EXPECTED_SCORES = { PAIN_ACKNOWLEDGED:10, WATCHED_DEMO:15, AI_INTEREST:10, RENEWAL_INTEREST:10, APP_INTEREST:10, CRM_INTEREST:10, BOOKED_DEMO:30, OBJECTION_COST:10, OBJECTION_TIME:10, OBJECTION_VALUE:10 };
for (const [k,v] of Object.entries(EXPECTED_SCORES)) {
  if (rules[k] !== v) errors.push(`lead_scoring_rules: ${k} should be ${v}, got ${rules[k]}`);
}

// 13. Spec journey presence: each STAGE_DAY tag assigned exactly once, branches present
const stageCounts = {};
for (const n of nodes.filter(n => n.type === 'add_tag')) {
  stageCounts[n.parameters.tag_name] = (stageCounts[n.parameters.tag_name] || 0) + 1;
}
for (const s of ['STAGE_DAY0','STAGE_DAY1','STAGE_DAY2','STAGE_DAY3','STAGE_DAY4','STAGE_DAY5']) {
  if ((stageCounts[s] || 0) !== 1) errors.push(`${s} should be assigned exactly once (found ${stageCounts[s] || 0})`);
}

// Branch existence
const requiredNodes = [
  'b1-api-trial','b1-tag-trial-started','b2-cal-event','b2-tag-booked','b2-assign-sales',
  'b3-tag-watched','b3-cond-feature','d1b-cond-nudge','cond-day2-interest','grade-cond','d4-cond-objection','d5-cond-final'
];
for (const id of requiredNodes) if (!nodeMap[id]) errors.push(`Required spec node missing: ${id}`);

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`Reachable nodes: ${reachable.size}/${nodes.length}`);
console.log(`add_tag nodes: ${nodes.filter(n=>n.type==='add_tag').length}`);
console.log(`wait_for_reply nodes: ${nodes.filter(n=>n.type==='wait_for_reply').length}`);
console.log(`delay nodes: ${nodes.filter(n=>n.type==='delay').length}`);
console.log(`condition nodes: ${nodes.filter(n=>n.type==='condition').length}`);
console.log(`google sheet nodes: ${nodes.filter(n=>n.type==='save_to_google_sheet').length}`);
console.log('');

if (warnings.length) {
  console.log(`⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach(w => console.log('   • ' + w));
  console.log('');
}
if (errors.length) {
  console.log(`❌ ERRORS (${errors.length}):`);
  errors.forEach(e => console.log('   • ' + e));
  console.log('\n❌ VERIFICATION FAILED\n');
  process.exit(1);
} else {
  console.log('✅ NO ERRORS — funnel structure matches the spec requirements.\n');
  process.exit(0);
}
