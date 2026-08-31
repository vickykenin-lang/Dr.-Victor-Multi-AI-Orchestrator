#!/usr/bin/env python3
# Idempotent runtime integration trigger for Victor layered memory.
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
worker=ROOT/'victor-telegram-worker/worker.js'
mem=ROOT/'victor-telegram-worker/memory_runtime.mjs'
mem_test=ROOT/'victor-telegram-worker/memory_runtime.test.mjs'

w=worker.read_text(encoding='utf-8')
old="""  ['FOUNDER_MEMORY', 'memory/founder_memory.json', false],
  ['DECISIONS', 'memory/decisions.jsonl', false],
  ['OPERATIONAL_MEMORY', 'memory/operational_memory.jsonl', false],
  ['MEMORY_INDEX', 'memory/memory_index.json', false],
"""
new="""  ['FOUNDER_MEMORY', 'memory/founder_memory.json', false],
  ['DECISIONS', 'memory/decisions.jsonl', false],
  ['LONG_TERM_MEMORY', 'memory/MEMORY.md', false],
  ['ACTIVE_PROJECTS_MEMORY', 'memory/ACTIVE_PROJECTS.md', false],
  ['WORKING_MEMORY', 'memory/WORKING_MEMORY.md', false],
  ['LEARNINGS_MEMORY', 'memory/LEARNINGS.md', false],
  ['OPERATIONAL_MEMORY', 'memory/operational_memory.jsonl', false],
  ['ACTIVITY_MEMORY', 'memory/ACTIVITY_LOG.md', false],
  ['MEMORY_INDEX_MD', 'memory/INDEX.md', false],
  ['MEMORY_INDEX', 'memory/memory_index.json', false],
"""
if old in w:
    w=w.replace(old,new,1)
elif "['LONG_TERM_MEMORY', 'memory/MEMORY.md', false]" not in w:
    raise SystemExit('WORKER_MEMORY_SOURCE_BLOCK_NOT_FOUND')
w=w.replace("memory_recall_mode: 'REPO_CANONICAL_RELEVANCE_V2'", "memory_recall_mode: 'LAYERED_REPO_MEMORY_V3'")
w=w.replace("['FOUNDER_MEMORY','DECISIONS','OPERATIONAL_MEMORY','MEMORY_INDEX']", "['FOUNDER_MEMORY','DECISIONS','LONG_TERM_MEMORY','ACTIVE_PROJECTS_MEMORY','WORKING_MEMORY','LEARNINGS_MEMORY','OPERATIONAL_MEMORY','ACTIVITY_MEMORY','MEMORY_INDEX_MD','MEMORY_INDEX']")
worker.write_text(w,encoding='utf-8')

m=mem.read_text(encoding='utf-8')
anchor="""    if (source.name === 'DECISIONS' || source.name === 'OPERATIONAL_MEMORY') {
      const cls = source.name === 'DECISIONS' ? 'decision' : 'operational';
      const priority = cls === 'decision' ? 90 : 70;
      for (const line of source.text.split(/\\r?\\n/)) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          records.push({ class: cls, priority, data, text: JSON.stringify(data) });
        } catch (_) {}
      }
    }
"""
layered="""    const layered = {
      LONG_TERM_MEMORY: ['long_term', 88],
      ACTIVE_PROJECTS_MEMORY: ['active_projects', 84],
      WORKING_MEMORY: ['working', 80],
      LEARNINGS_MEMORY: ['learning', 76],
      ACTIVITY_MEMORY: ['activity', 60],
      MEMORY_INDEX_MD: ['index', 50],
    };
    if (layered[source.name]) {
      const [cls, priority] = layered[source.name];
      records.push({
        class: cls,
        priority,
        data: { type: cls, source: source.name, content: source.text },
        text: source.text,
      });
    }
"""
if 'const layered = {' not in m:
    if anchor not in m: raise SystemExit('MEMORY_PARSE_ANCHOR_NOT_FOUND')
    m=m.replace(anchor,anchor+layered,1)

# Memory writes must be explicit Founder save/lock commands. Ordinary words such as
# "final reply", "final certification", "permanent issue", or "record status" must
# not steal an executive/department command from the Brain routing path.
old_patterns="""const LOCK_PATTERNS = [
  /\\b(lock|locked|final|permanent|remember|save|store|record)\\b/i,
  /\\b(yaad\\s+rakh|yaad\\s+rakho|save\\s+kar|store\\s+kar|lock\\s+kar|record\\s+kar|record\\s+karo)\\b/i,
];
"""
new_patterns="""const LOCK_PATTERNS = [
  /\\b(remember|save|store)\\s+(this|it|this\\s+decision|this\\s+rule|this\\s+instruction)\\b/i,
  /\\b(yaad\\s+rakh(?:o)?|save\\s+kar(?:o)?|store\\s+kar(?:o)?|lock\\s+kar(?:o)?|record\\s+kar(?:o)?)\\b/i,
  /\\b(lock|record)\\s+(this|it|this\\s+decision|this\\s+rule|this\\s+instruction)\\b/i,
];
"""
if old_patterns in m:
    m=m.replace(old_patterns,new_patterns,1)
elif new_patterns not in m:
    raise SystemExit('MEMORY_DIRECTIVE_PATTERN_BLOCK_NOT_FOUND')
mem.write_text(m,encoding='utf-8')

# Regression tests for the false-positive that blocked the AURA3 executive command.
t=mem_test.read_text(encoding='utf-8')
needle="""  assert.equal(isExplicitMemoryDirective('record karo- aura 2 hold me rakho'), true);
  assert.equal(isExplicitMemoryDirective('Status batao'), false);
"""
replacement="""  assert.equal(isExplicitMemoryDirective('record karo- aura 2 hold me rakho'), true);
  assert.equal(isExplicitMemoryDirective('Save this decision'), true);
  assert.equal(isExplicitMemoryDirective('Status batao'), false);
  assert.equal(isExplicitMemoryDirective('Final reply me verified root cause aur next action do'), false);
  assert.equal(isExplicitMemoryDirective('AURA3 final certification evidence ke saath do'), false);
  assert.equal(isExplicitMemoryDirective('Record status aur exact next action batao'), false);
"""
if needle in t:
    t=t.replace(needle,replacement,1)
elif "Final reply me verified root cause" not in t:
    raise SystemExit('MEMORY_TEST_ANCHOR_NOT_FOUND')
mem_test.write_text(t,encoding='utf-8')

print('LAYERED_MEMORY_RUNTIME_PATCHED')
