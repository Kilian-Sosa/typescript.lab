import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mockup = join(root, 'docs', 'design', 'mockups');
const requiredFiles = [
  'README.md',
  'AGENTS.md',
  '.gitignore',
  'ROADMAP.md',
  'docs/superpowers/specs/2026-10-16-typescript-lab-design.md',
  'docs/superpowers/specs/2026-10-16-shared-contracts-design.md',
  'docs/superpowers/specs/2026-10-17-dedicated-runner-design.md',
  'docs/superpowers/plans/2026-10-16-parallel-agent-infrastructure.md',
  'docs/superpowers/plans/2026-10-16-initial-parallel-wave.md',
  'docs/superpowers/plans/2026-10-16-foundation-and-catalog.md',
  'docs/superpowers/plans/2026-10-16-challenge-content.md',
  'docs/superpowers/plans/2026-10-16-runner-security.md',
  'docs/superpowers/plans/2026-10-17-quickjs-runner-implementation.md',
  'docs/superpowers/plans/2026-10-16-auth-and-drafts.md',
  'docs/superpowers/plans/2026-10-16-notebook-history.md',
  'docs/superpowers/plans/2026-10-16-release-polish.md',
  'docs/decisions/0001-frontend-platform.md',
  'docs/decisions/0002-challenges-and-execution.md',
  'docs/decisions/0003-solution-persistence.md',
  'docs/superpowers/plans/README.md',
  'docs/design/README.md',
  'docs/design/mockups/README.md',
  'docs/design/mockups/index.html',
  'docs/design/mockups/styles.css',
  'docs/design/mockups/app.js',
];

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), 'Missing required design file: ' + file);
}

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (
      name === '.git' ||
      name === 'node_modules' ||
      ['.worktrees', '.pnpm-store', '.npm-cache', 'dist', 'coverage', 'test-results', 'playwright-report'].includes(
        name,
      ) ||
      (name === 'prompts' && dir === join(root, 'docs'))
    )
      return [];
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

let checkedLinks = 0;
for (const file of markdownFiles(root)) {
  const markdown = readFileSync(file, 'utf8');
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const destination = match[1].split('#')[0];
    if (!destination || /^(https?:|mailto:|data:)/.test(destination)) continue;
    const target = resolve(dirname(file), decodeURIComponent(destination));
    assert(target.startsWith(root), 'Documentation link escapes repository: ' + file);
    const privatePrompts = join(root, 'docs', 'prompts');
    assert(
      target !== privatePrompts && !target.startsWith(privatePrompts + sep),
      'Published docs must not link to local-only prompts: ' + file,
    );
    assert(existsSync(target), 'Broken documentation link: ' + file + ' -> ' + destination);
    checkedLinks++;
  }
}

const html = readFileSync(join(mockup, 'index.html'), 'utf8');
const css = readFileSync(join(mockup, 'styles.css'), 'utf8');
const js = readFileSync(join(mockup, 'app.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs detected');
assert(ids.includes('screen-explore') && ids.includes('screen-solve') && ids.includes('screen-notebook'));
assert(html.includes('href="./styles.css"') && html.includes('src="./app.js"'));

for (const match of js.matchAll(/\$\(\s*(['"])#([A-Za-z][\w-]*)\1\s*\)/g)) {
  assert(ids.includes(match[2]), 'JavaScript references a nonexistent ID: ' + match[2]);
}

assert(/@media\s*\(\s*max-width\s*:\s*700px\s*\)/.test(css), 'Mobile layout rules missing');
assert(/\[data-theme\s*=\s*(['"])dark\1\]/.test(css), 'Dark theme styles missing');
assert(js.includes('Not connected'), 'Prototype must never fabricate test success');
assert(html.includes('Illustrative data'), 'Demo data must be disclosed');

const roadmap = readFileSync(join(root, 'ROADMAP.md'), 'utf8');
const planIndex = readFileSync(join(root, 'docs', 'superpowers', 'plans', 'README.md'), 'utf8');
for (let milestone = 1; milestone <= 6; milestone++) {
  assert(roadmap.includes('| M' + milestone + ' '), 'Roadmap milestone missing: M' + milestone);
  assert(planIndex.includes('M' + milestone + ' —'), 'Implementation plan index missing: M' + milestone);
}
for (const plan of requiredFiles.filter(
  (file) => file.includes('docs/superpowers/plans/') && !file.endsWith('/README.md'),
)) {
  const text = readFileSync(join(root, plan), 'utf8');
  assert(text.includes('**Goal:**') && text.includes('**Spec:**'), 'Superpowers plan header incomplete: ' + plan);
  assert(text.includes('## Review Focus') && /- \[[ x]\]/.test(text), 'TDD plan has no task checklist: ' + plan);
}

console.log(
  'Design checks passed: ' +
    requiredFiles.length +
    ' required files, ' +
    checkedLinks +
    ' relative documentation links, ' +
    ids.length +
    ' unique HTML IDs.',
);
