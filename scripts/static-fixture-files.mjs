import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

// Request URLs select from this prebuilt index; they never become filesystem paths.
export async function indexFixtureFiles(root) {
  const files = new Map();
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    files.set('/' + relative(root, file).split(sep).join('/'), file);
  }
  return files;
}
