#!/usr/bin/env node
/**
 * Updates DEVELOPMENT_CONTEXT.md with:
 * - Last git commit message (section 5. Last Commit Summary)
 * - Current project file tree (section 8. Project Structure)
 *
 * Run manually: node scripts/update-context.js
 * Or via pre-commit hook.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONTEXT_FILE = path.join(ROOT, 'DEVELOPMENT_CONTEXT.md');

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '.husky',
]);

const IGNORE_FILES = new Set(['.DS_Store', 'package-lock.json']);

function getLastCommitMessage() {
  try {
    const msg = execSync('git log -1 --pretty=format:"%h %s%n%n%b" --date=short', {
      encoding: 'utf-8',
      cwd: ROOT,
    });
    const date = execSync('git log -1 --pretty=format:"%ci"', {
      encoding: 'utf-8',
      cwd: ROOT,
    }).trim().slice(0, 10);
    return `**${date}** — ${msg.replace(/^"/, '').replace(/"$/, '')}`;
  } catch {
    return '*(No git history or not a git repo.)*';
  }
}

function buildTree(dir, prefix = '', baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const filtered = entries
    .filter((e) => {
      if (e.name.startsWith('.')) return false;
      if (e.isDirectory() && IGNORE_DIRS.has(e.name)) return false;
      if (e.isFile() && IGNORE_FILES.has(e.name)) return false;
      return true;
    })
    .sort((a, b) => {
      const adir = a.isDirectory() ? 0 : 1;
      const bdir = b.isDirectory() ? 0 : 1;
      if (adir !== bdir) return adir - bdir;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

  const lines = [];
  for (let i = 0; i < filtered.length; i++) {
    const e = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const name = e.name + (e.isDirectory() ? '/' : '');
    lines.push(prefix + connector + name);
    if (e.isDirectory()) {
      const subPrefix = prefix + (isLast ? '    ' : '│   ');
      const subPath = path.join(dir, e.name);
      lines.push(...buildTree(subPath, subPrefix, baseDir));
    }
  }
  return lines;
}

function getProjectStructure() {
  const lines = buildTree(ROOT);
  return lines.length ? lines.join('\n') : '(empty)';
}

function updateContextFile() {
  let content = fs.readFileSync(CONTEXT_FILE, 'utf-8');

  const lastCommit = getLastCommitMessage();
  const projectStructure = getProjectStructure();

  // Update "## 5. Last Commit Summary" section (content until next --- or ##)
  const lastCommitSection = /(## 5\. Last Commit Summary\s*\n\n)([\s\S]*?)(\n\n---\s*\n)/;
  const newLastCommitBody = lastCommit + '\n\n*(Run `node scripts/update-context.js` to refresh.)*';
  content = content.replace(lastCommitSection, `$1${newLastCommitBody}$3`);

  // Update or insert "## 8. Project Structure" section
  const projectStructureBlock = `## 8. Project Structure

\`\`\`
.
${projectStructure}
\`\`\`

`;
  const section8Regex = /## 8\. Project Structure[\s\S]*?(?=\n---\s*\n\*Update this file|\n\*Update this file)/;
  if (section8Regex.test(content)) {
    content = content.replace(section8Regex, projectStructureBlock);
  } else {
    // Insert before final "*Update this file"
    content = content.replace(
      /\n---\s*\n\*Update this file/,
      `\n---\n\n${projectStructureBlock}\n---\n\n*Update this file`
    );
  }

  fs.writeFileSync(CONTEXT_FILE, content, 'utf-8');
  console.log('Updated DEVELOPMENT_CONTEXT.md (Last Commit Summary + Project Structure).');
}

updateContextFile();
