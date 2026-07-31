import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const isAll = process.argv.includes('--all');

const removeDirNames = new Set(['dist']);
if (isAll) {
  removeDirNames.add('node_modules');
  removeDirNames.add('.turbo');
}

const skipDirNames = new Set(['.git']);
if (!isAll) {
  skipDirNames.add('node_modules');
}

const removeFileSuffixes = ['.tsbuildinfo'];

function removePath(path) {
  rmSync(path, { recursive: true, force: true });
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (removeDirNames.has(entry.name)) {
        removePath(fullPath);
        continue;
      }

      if (skipDirNames.has(entry.name)) {
        continue;
      }

      walk(fullPath);
      continue;
    }

    if (
      entry.isFile() &&
      removeFileSuffixes.some((suffix) => entry.name.endsWith(suffix))
    ) {
      removePath(fullPath);
    }
  }
}

walk(rootDir);
