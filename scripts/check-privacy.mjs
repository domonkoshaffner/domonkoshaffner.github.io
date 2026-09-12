import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This is a guard against accidental publication, not a substitute for reviewing
// the copy, external links, or the files in a commit before pushing a public repo.
const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] ?? '--all';
if (!['--source', '--build', '--all'].includes(mode)) {
  throw new Error('Usage: node scripts/check-privacy.mjs [--source|--build|--all]');
}

// Add assets only after reviewing their contents and removing private metadata.
const approvedAssets = new Set(['favicon.svg', 'images/portrait.jpg']);
const findings = [];
let checked = 0;
const report = (file, reason) => findings.push(`${file}: ${reason}`);
const agentPath = /(^|\/)(?:(?:agents|claude|gemini)(?:\.[^/]+)?\.md|\.(?:agent|agents|claude|codex|openai|gemini|cursor|windsurf|cline|roo|kilocode|continue|opencode)(?:\/|$)|\.(?:cursorrules|cursorignore|cursorindexingignore|windsurfrules|clinerules|roomodes)(?:\/|$)|\.(?:aider|roorules)[^/]*(?:\/|$)|\.?mcp\.json$|opencode\.jsonc?$)|(^|\/)\.github\/(?:copilot-instructions\.md$|(?:agents|instructions|prompts|skills)\/)/i;
const privatePath = /(^|\/)(?:public|\.local|\.git|\.astro|node_modules)(?:\/|$)|(^|\/)\.env(?:\.|$)|\.(?:crt|cer|der|pem|key|p12|pfx|jks|log|bak|orig|map)$|(^|\/)(?:\.DS_Store|\.npmrc|\.yarnrc\.yml)$|~$/i;
const rules = [
  ['email address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['direct email or telephone link', /\b(?:mailto|tel):/i],
  ['private filesystem path', /\/(?:Users|home)\/|file:\/\/\/|[A-Z]:\\Users\\/i],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['service credential', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{30,}|(?:AKIA|ASIA)[0-9A-Z]{16}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|xox[baprs]-[A-Za-z0-9-]{20,})/],
  ['credential assignment', /(?:api[_-]?key|client[_-]?secret|password|auth[_-]?token|access[_-]?token)\s*[:=]\s*["'][^"'\s]{8,}/i],
  ['credentials in a URL', /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ['secret-bearing URL', /https?:\/\/[^\s"<>]+[?&](?:token|access_token|api_key|apikey|secret|key|signature|auth)=/i],
];

function walk(directory) {
  if (!existsSync(resolve(root, directory))) throw new Error(`Missing ${directory}; run npm run build first.`);
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function checkJpeg(file, bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    report(file, 'invalid JPEG');
    return;
  }
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) {
      report(file, 'invalid JPEG marker');
      return;
    }
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (offset !== bytes.length) report(file, 'unexpected data after JPEG image');
      return;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    const payload = bytes.subarray(offset + 2, offset + length);
    if (marker === 0xfe || (marker >= 0xe0 && marker <= 0xef)) {
      // Preserve display information: JFIF, ICC colour profile, Adobe transform.
      const permitted = (marker === 0xe0 && payload.subarray(0, 5).toString() === 'JFIF\0'
          && payload.length === 14 && payload[12] === 0 && payload[13] === 0)
        || (marker === 0xe2 && payload.subarray(0, 12).toString() === 'ICC_PROFILE\0')
        || (marker === 0xee && payload.subarray(0, 5).toString() === 'Adobe' && payload.length === 12);
      if (!permitted) report(file, 'embedded image metadata or thumbnail; strip metadata before publishing');
    }
    offset += length;
    if (marker === 0xda) {
      // Scan past compressed pixels, handling escaped bytes and restart markers.
      // Continue parsing subsequent scans so metadata after a scan is checked too.
      while (offset < bytes.length) {
        const next = bytes.indexOf(0xff, offset);
        if (next < 0) { offset = bytes.length; break; }
        const following = bytes[next + 1];
        if (following === 0x00 || (following >= 0xd0 && following <= 0xd7)) {
          offset = next + 2;
        } else { offset = next; break; }
      }
    }
  }
  report(file, 'truncated JPEG');
}

function checkFile(file, scope, candidates) {
  checked++;
  if (privatePath.test(file)) report(file, 'private, temporary, or source-map file');
  if (agentPath.test(file)) report(file, 'local AI agent configuration');
  const absolute = resolve(root, file);
  if (lstatSync(absolute).isSymbolicLink()) {
    if (isAbsolute(readlinkSync(absolute)) || !existsSync(absolute)) {
      report(file, 'absolute or broken symlink');
      return;
    }
    const target = relative(root, realpathSync(absolute));
    if (scope !== 'source' || target.startsWith('..') || !candidates.has(target) || privatePath.test(target) || agentPath.test(target)) {
      report(file, 'symlink to an unapproved file');
    }
    return;
  }
  const bytes = readFileSync(absolute);
  const extension = extname(file).toLowerCase();
  if (scope === 'build') {
    const output = file.slice('dist/'.length);
    const generated = extension === '.html'
      || (/^_astro\//.test(output) && ['.js', '.css', '.woff', '.woff2'].includes(extension));
    if (!generated && !approvedAssets.has(output)) report(file, 'unexpected file in deployment output');
    if (extension === '.woff' || extension === '.woff2') return;
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    if (scope === 'source' && !file.startsWith('static/')) report(file, 'image outside curated static assets');
    checkJpeg(file, bytes);
    return;
  }
  const textExtensions = ['.astro', '.ts', '.js', '.mjs', '.css', '.html', '.svg', '.md', '.json', '.yml', '.yaml'];
  if (!textExtensions.includes(extension) && file !== '.gitignore') {
    report(file, 'unreviewed file type; private references belong in the ignored local folder');
    return;
  }
  const text = bytes.toString('utf8');
  for (const [reason, pattern] of rules) {
    if (pattern.test(text)) report(file, reason);
  }
  if (scope === 'build' && /sourceMappingURL|sourcesContent/.test(text)) report(file, 'source-map content');
  if (extension === '.svg' && /<metadata\b|<image\b|<script\b/i.test(text)) {
    report(file, 'SVG metadata, embedded image, or script needs review');
  }
}

if (mode === '--source' || mode === '--all') {
  const candidates = new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root, encoding: 'utf8',
  }).split('\0').filter((file) => file && lstatSync(resolve(root, file), { throwIfNoEntry: false })));
  for (const file of candidates) checkFile(file, 'source', candidates);
  // Git ignores do not control Astro's static assets. Check every file here,
  // including ignored files, since Astro copies the entire directory.
  for (const file of walk('static')) {
    if (!approvedAssets.has(file.slice('static/'.length))) report(file, 'unapproved public asset');
    if (!candidates.has(file)) checkFile(file, 'source', candidates);
  }
  const privateCandidates = [
    'public/privacy-check.txt', '.local/privacy-check.txt', '.env', '.env.local', '.env.production.local',
    'AGENTS.md', 'agents.md', 'CLAUDE.md', 'claude.md', 'src/AGENTS.md', 'CLAUDE.local.md',
    '.agents/skills/example/SKILL.md', '.claude/settings.json', '.codex/config.toml',
    '.cursor/rules/example.mdc', '.github/copilot-instructions.md', '.github/agents/example.md',
    '.mcp.json', '.vscode/mcp.json', 'GEMINI.md', 'opencode.jsonc',
  ];
  const ignored = new Set(execFileSync('git', ['check-ignore', '--no-index', ...privateCandidates], {
    cwd: root, encoding: 'utf8',
  }).trim().split('\n'));
  for (const file of privateCandidates) if (!ignored.has(file)) report(file, 'missing Git ignore protection');
}
if (mode === '--build' || mode === '--all') {
  for (const file of walk('dist')) checkFile(file, 'build');
}

if (findings.length) {
  console.error(`Privacy check failed (${findings.length} findings):`);
  // Report locations and categories only; never echo a detected secret to CI logs.
  for (const finding of new Set(findings)) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Privacy check passed: ${checked} ${mode.slice(2)} files checked.`);
}
