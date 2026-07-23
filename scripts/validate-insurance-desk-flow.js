#!/usr/bin/env node
/**
 * Validates the Insurance Desk flow by parsing node IDs from helper function calls.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, 'seed-insurance-desk-flow.js'), 'utf-8');

console.log('─'.repeat(60));
console.log(' Insurance Desk Flow — Structure Validation');
console.log('─'.repeat(60));

// ── Extract node IDs from ALL helper function calls ──
// Pattern: helperFunc('node-id', ...)  OR  helperFunc(\n    'node-id', ...)
const nodeIds = new Set();
const nodeTypes = {};

// Helper function calls that create nodes:
// listMsg('id', ...), btnMsg('id', ...), textMsg('id', ...), ctaBtn('id', ...),
// addTag('id', ...), waitReply('id', ...), conditionNode('id', ...)
const helperPattern = /(listMsg|btnMsg|textMsg|ctaBtn|addTag|waitReply|conditionNode)\(\s*\n?\s*'([^']+)'/g;
let match;
while ((match = helperPattern.exec(src)) !== null) {
  nodeIds.add(match[2]);
  const funcToType = {
    listMsg: 'send_message (list)',
    btnMsg: 'send_message (button)',
    textMsg: 'send_message (text)',
    ctaBtn: 'cta_button',
    addTag: 'add_tag',
    waitReply: 'wait_for_reply',
    conditionNode: 'condition'
  };
  const type = funcToType[match[1]] || match[1];
  nodeTypes[type] = (nodeTypes[type] || 0) + 1;
}

// Also catch the trigger node (defined inline)
const triggerMatch = src.match(/id:\s*'(trigger[^']*)',\s*\n?\s*type:\s*'trigger'/);
if (triggerMatch) {
  nodeIds.add(triggerMatch[1]);
  nodeTypes['trigger'] = 1;
}

console.log(`\n📦 Unique nodes: ${nodeIds.size}`);

// ── Extract connections ──
const allConns = [];
const connPattern = /conn\('([^']+)',\s*'([^']+)'(?:,\s*'([^']+)')?\)/g;
while ((match = connPattern.exec(src)) !== null) {
  allConns.push({ source: match[1], target: match[2], handle: match[3] || 'output' });
}

console.log(`🔗 Connections: ${allConns.length}`);

// ── Check for missing node references ──
const missingSrc = [...new Set(allConns.filter(c => !nodeIds.has(c.source)).map(c => c.source))];
const missingTgt = [...new Set(allConns.filter(c => !nodeIds.has(c.target)).map(c => c.target))];

if (missingSrc.length > 0) {
  console.log(`\n❌ Connection sources → MISSING nodes:`, missingSrc);
} else {
  console.log(`\n✅ All ${new Set(allConns.map(c=>c.source)).size} connection sources valid`);
}

if (missingTgt.length > 0) {
  console.log(`❌ Connection targets → MISSING nodes:`, missingTgt);
} else {
  console.log(`✅ All ${new Set(allConns.map(c=>c.target)).size} connection targets valid`);
}

// ── Duplicate IDs ──
const ids = [];
const dupPat = /(listMsg|btnMsg|textMsg|ctaBtn|addTag|waitReply|conditionNode)\(\s*\n?\s*'([^']+)'/g;
while ((match = dupPat.exec(src)) !== null) ids.push(match[2]);
if (triggerMatch) ids.push(triggerMatch[1]);
const seen = new Set();
const dups = ids.filter(id => { if (seen.has(id)) return true; seen.add(id); return false; });
if (dups.length > 0) {
  console.log(`\n❌ Duplicate IDs:`, [...new Set(dups)]);
} else {
  console.log(`✅ No duplicate node IDs`);
}

// ── Entry & Terminal nodes ──
const connSources = new Set(allConns.map(c => c.source));
const connTargets = new Set(allConns.map(c => c.target));
const termNodes = [...nodeIds].filter(id => !connSources.has(id));
const entryNodes = [...nodeIds].filter(id => !connTargets.has(id));

console.log(`\n📋 Entry nodes:    ${entryNodes.join(', ') || '(none)'}`);
console.log(`📋 Terminal nodes: ${termNodes.join(', ') || '(none)'}`);

// ── Node type counts ──
console.log(`\n📊 Node type breakdown:`);
for (const [type, count] of Object.entries(nodeTypes).sort()) {
  console.log(`   ${type}: ${count}`);
}

// ── Tags ──
const tagPattern = /label:\s*'([^']+)'/g;
const tags = [];
while ((match = tagPattern.exec(src)) !== null) tags.push(match[1]);
console.log(`\n🏷  Tags: ${tags.length} (${tags.join(', ')})`);

// ── Timeouts ──
const toPattern = /waitReply\('[^']+',\s*'[^']*',\s*\w+,\s*[\w+ ]+,\s*(\d+),\s*'([^']+)'/g;
const timeouts = [];
while ((match = toPattern.exec(src)) !== null) timeouts.push(`${match[1]}${match[2][0]}`);
console.log(`\n⏱  Timeouts: ${timeouts.join(' → ') || '(parsing via function args)'}`);

// ── Lead Scoring ──
const scorePattern = /'([^']+)':\s*(-?\d+)/g;
const scoreStart = src.indexOf('lead_scoring_rules');
const scoreEnd = src.indexOf('};', scoreStart);
const scoreSection = src.slice(scoreStart, scoreEnd);
const scores = [];
while ((match = scorePattern.exec(scoreSection)) !== null) {
  scores.push(`${match[1]}(${match[2]})`);
}
console.log(`\n📈 Lead scoring: ${scores.join(', ')}`);

console.log('\n' + '─'.repeat(60));
if (missingSrc.length === 0 && missingTgt.length === 0 && dups.length === 0) {
  console.log(' ✅ ALL CHECKS PASSED');
} else {
  console.log(' ❌ ISSUES FOUND — see above');
}
console.log('─'.repeat(60));
