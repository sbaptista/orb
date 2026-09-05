/* eslint-disable @typescript-eslint/no-require-imports */
//
// verify-handoff.js — checks the HANDOFF.md rules and fails when they are broken.
//
// Rules and rationale: docs/handoff-conventions.md (single source of truth).
//
// Why this exists: the "replaces prior" rule already existed as prose in
// AGENTS.md and was ignored by two separate AI tools for twelve consecutive
// sessions. Codex's review (H-Q3) concluded that stronger wording alone was
// unlikely to prevent recurrence, and specified the checks below. Writing the
// rule down did not hold. A check that fails does.
//
// The main rule: `## Uncommitted Changes` lists paths that `git status` reports
// as dirty, and nothing else. That section is read as instructions — shared
// working rule 11 tells the next agent to re-read every file named there — so a
// path that is not actually dirty costs that agent a wasted read. 25 of them on
// 2026-09-03.

const { execSync } = require('child_process');
const fs = require('fs');

const HANDOFF = 'HANDOFF.md';
const CANONICAL_HEADINGS = [
  '## App State',
  '## Uncommitted Changes',
  '## Last Session Completed',
  '## Active Risks / Unresolved Work',
  '## Next Priorities',
  '## Key Current Decisions',
  '## AI Tool Used Last Session',
];
const SOFT_LINE_CEILING = 400;

const errors = [];
const warnings = [];

if (!fs.existsSync(HANDOFF)) {
  console.error(`verify-handoff: ${HANDOFF} not found`);
  process.exit(1);
}
const text = fs.readFileSync(HANDOFF, 'utf8');
const lines = text.split('\n');

// ---- 1. Exactly one instance of every canonical heading -------------------
for (const heading of CANONICAL_HEADINGS) {
  const count = lines.filter(l => l.trim() === heading).length;
  if (count === 0) errors.push(`missing canonical heading: "${heading}"`);
  if (count > 1) errors.push(`heading appears ${count} times, expected once: "${heading}"`);
}

// ---- 2. No duplicate/near-duplicate "uncommitted" headings ----------------
const uncommittedHeadings = lines.filter(
  l => /^#{1,4}\s/.test(l) && /uncommitted/i.test(l)
);
if (uncommittedHeadings.length > 1) {
  errors.push(
    `${uncommittedHeadings.length} headings mention "uncommitted"; exactly one is allowed:\n` +
    uncommittedHeadings.map(h => `      ${h.trim()}`).join('\n')
  );
}

// ---- 3. No chained session history ---------------------------------------
const priorSession = lines
  .map((l, i) => ({ l, n: i + 1 }))
  .filter(({ l }) => /^\**Prior session/i.test(l.trim()));
if (priorSession.length > 0) {
  errors.push(
    `${priorSession.length} "Prior session" block(s) found at line(s) ` +
    `${priorSession.map(p => p.n).join(', ')}. ` +
    `"Last Session Completed" REPLACES the prior entry (conventions §3.4); ` +
    `that history is already in git and lib/changelog.ts.`
  );
}

// ---- 4. Uncommitted Changes is a path-only projection of git status -------
const startIdx = lines.findIndex(l => l.trim() === '## Uncommitted Changes');
if (startIdx !== -1) {
  let endIdx = lines.findIndex((l, i) => i > startIdx && /^##\s/.test(l));
  if (endIdx === -1) endIdx = lines.length;
  const section = lines.slice(startIdx + 1, endIdx);

  const dirty = new Set();
  const porcelain = execSync('git status --porcelain', { encoding: 'utf8' });
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue;
    const filePart = line.substring(3).trim();
    if (filePart.includes(' -> ')) filePart.split(' -> ').forEach(p => dirty.add(p.trim()));
    else dirty.add(filePart);
  }

  // Only bullet lines are scanned. Prose may reference other documents (e.g.
  // the conventions pointer) without being read as a re-read instruction.
  const claimed = [];
  for (const line of section) {
    if (!/^\s*[-*]\s/.test(line)) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const candidate = m[1].trim();
      if (/^[\w./-]+\.[A-Za-z0-9]+$/.test(candidate) || candidate.endsWith('/')) {
        claimed.push(candidate);
      }
    }
  }

  const stale = claimed.filter(p => !dirty.has(p));
  if (stale.length > 0) {
    errors.push(
      `"Uncommitted Changes" names ${stale.length} path(s) that git reports as clean:\n` +
      stale.map(p => `      ${p}`).join('\n') +
      `\n      Every path there is re-read by the next agent (working rule 11).` +
      `\n      It is a projection of git status, not a release manifest.`
    );
  }

  const missing = [...dirty].filter(p => !claimed.includes(p));
  if (missing.length > 0) {
    warnings.push(
      `git reports ${missing.length} dirty path(s) not listed in "Uncommitted Changes":\n` +
      missing.map(p => `      ${p}`).join('\n')
    );
  }

  const body = section.join('\n').trim();
  if (dirty.size === 0 && !/\bnone\b/i.test(body)) {
    errors.push('git status is clean, so "Uncommitted Changes" must say None.');
  }

  if (/\bv?\d+\.\d+\.\d+\b/.test(body)) {
    errors.push(
      'version number found in "Uncommitted Changes" — that reads as a release ' +
      'manifest. Per-release file lists belong in lib/changelog.ts.'
    );
  }
}

// ---- 5. Size ceiling (advisory) ------------------------------------------
if (lines.length > SOFT_LINE_CEILING) {
  warnings.push(
    `${HANDOFF} is ${lines.length} lines (soft ceiling ${SOFT_LINE_CEILING}). ` +
    `Every agent reads it in full at session start, so length is a direct cost.`
  );
}

// ---- Report ---------------------------------------------------------------
for (const w of warnings) console.warn(`verify-handoff: WARNING  ${w}`);
if (errors.length > 0) {
  console.error(`\nverify-handoff: ${errors.length} error(s) in ${HANDOFF}\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`\nRules: docs/handoff-conventions.md\n`);
  process.exit(1);
}
console.log(`verify-handoff: ${HANDOFF} passed (${lines.length} lines).`);
