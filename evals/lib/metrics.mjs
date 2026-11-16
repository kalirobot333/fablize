// Process metrics from a `claude -p --output-format stream-json --verbose` log.
// Uses the gate's own classifier so "change" and "check" mean the same thing
// in the eval as in the gate.

import { readFileSync } from 'node:fs';
import { classify } from '../../skills/fablize/scripts/gate.mjs';

export function metrics(streamFile) {
  const lines = readFileSync(streamFile, 'utf8').split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch {}
  }

  const calls = new Map(); // tool_use id -> { name, input }
  const order = [];
  let result = null;
  let gateBlocks = 0;

  for (const ev of events) {
    const raw = JSON.stringify(ev);
    if (ev.type !== 'result' && raw.includes('fablize gate: code changed')) gateBlocks++;
    if (ev.type === 'assistant' && ev.message?.content) {
      for (const part of ev.message.content) {
        if (part.type === 'tool_use') {
          calls.set(part.id, { name: part.name, input: part.input || {}, error: false });
          order.push(part.id);
        }
      }
    }
    if (ev.type === 'user' && Array.isArray(ev.message?.content)) {
      for (const part of ev.message.content) {
        if (part.type === 'tool_result' && calls.has(part.tool_use_id)) {
          calls.get(part.tool_use_id).error = !!part.is_error;
        }
      }
    }
    if (ev.type === 'result') result = ev;
  }

  let seq = 0, lastChange = 0, lastCheck = 0, checks = 0, changes = 0, observations = 0;
  const toolCounts = {};
  for (const id of order) {
    const c = calls.get(id);
    toolCounts[c.name] = (toolCounts[c.name] || 0) + 1;
    if (c.error) continue;
    const k = classify({ tool_name: c.name, tool_input: c.input, tool_response: {} });
    if (k.change) { lastChange = ++seq; changes++; }
    if (k.check) {
      lastCheck = ++seq; checks++;
      if (c.name.startsWith('mcp__') || c.name === 'Read') observations++;
    }
  }

  const finalText = result?.result || '';
  return {
    finalText,
    costUsd: result?.total_cost_usd ?? null,
    turns: result?.num_turns ?? null,
    durationS: result?.duration_ms ? Math.round(result.duration_ms / 1000) : null,
    isError: result?.is_error ?? true,
    toolCalls: order.length,
    toolCounts,
    changes,
    checks,
    observations,
    checkedAfterLastChange: changes === 0 || lastCheck > lastChange,
    verifiedLine: /^\**Verified:?\**/m.test(finalText),
    notVerifiedLine: /^\**Not verified:?\**/m.test(finalText),
    gateBlocks,
  };
}
