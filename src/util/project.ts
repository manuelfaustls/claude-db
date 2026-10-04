import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

export function resolveProject(path: string | undefined): string {
  const absolute = resolve(path ?? process.cwd());
  let canonical: string;
  try {
    canonical = realpathSync(absolute);
  } catch {
    return absolute;
  }
  return repoRoot(canonical) ?? canonical;
}

function repoRoot(start: string): string | null {
  const home = canonicalHome();

  for (let dir = start; ;) {
    if (dir === sep || dir === home || home.startsWith(dir + sep)) return null;
    if (existsSync(join(dir, '.git'))) return mainWorktree(dir) ?? dir;

    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// A linked worktree's `.git` is a file naming its gitdir, and that gitdir's
// `commondir` names the shared `.git` of the main checkout. Keying the main
// checkout makes every worktree of a repository share one project. Anything
// else (a submodule, a dangling pointer, a bare common dir) keys itself.
function mainWorktree(dir: string): string | null {
  try {
    const dotGit = join(dir, '.git');
    if (!statSync(dotGit).isFile()) return null;
    const match = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'));
    if (!match) return null;
    const gitDir = resolve(dir, match[1]!.trim());
    const common = resolve(gitDir, readFileSync(join(gitDir, 'commondir'), 'utf8').trim());
    if (basename(common) !== '.git') return null;
    return realpathSync(dirname(common));
  } catch {
    return null;
  }
}

let cachedHome: string | null = null;

function canonicalHome(): string {
  if (cachedHome === null) {
    try {
      cachedHome = realpathSync(homedir());
    } catch {
      cachedHome = homedir();
    }
  }
  return cachedHome;
}
