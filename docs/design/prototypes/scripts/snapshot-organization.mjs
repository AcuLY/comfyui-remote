import { lstat, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Metadata-only fixture capture. The source tree is never modified or opened
// for file contents; links (including Windows junctions) are not traversed.
const usage = 'node snapshot-organization.mjs --root <directory> --out <snapshot.json>';
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const compare = (a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
const slash = (value) => value.split(path.sep).join('/');
const folderKey = (relative) => relative ? `./${slash(relative)}` : 'root';
const errorCode = (error) => error?.code || 'UNKNOWN_ERROR';

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    if (!['--root', '--out'].includes(name) || !args[i + 1] || args[i + 1].startsWith('--') || options[name]) {
      throw new Error(`Expected explicit --root and --out. Usage: ${usage}`);
    }
    options[name] = args[i + 1];
  }
  if (!options['--root'] || !options['--out']) throw new Error(`Usage: ${usage}`);
  return { root: path.resolve(options['--root']), out: path.resolve(options['--out']) };
}

// Checking each existing ancestor also prevents resolving through a junction
// supplied as part of the root or output path.
async function assertNoLinkedAncestors(target) {
  const ancestors = [];
  for (let current = target; ; current = path.dirname(current)) {
    ancestors.push(current);
    if (path.dirname(current) === current) break;
  }
  for (const current of ancestors.reverse()) {
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error('Root and output paths must not traverse symbolic links or junctions.');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${Number(value.toFixed(1))} ${units[index]}`;
}

async function main() {
  const { root, out } = parseArgs(process.argv.slice(2));
  const outputRelative = path.relative(root, out);
  if (!outputRelative || (!path.isAbsolute(outputRelative) && outputRelative !== '..' && !outputRelative.startsWith(`..${path.sep}`))) {
    throw new Error('--out must be outside --root.');
  }
  await assertNoLinkedAncestors(root);
  await assertNoLinkedAncestors(out);
  if (!(await lstat(root)).isDirectory()) throw new Error('--root must be a directory.');

  const snapshot = {
    version: 1,
    capturedAt: new Date().toISOString(),
    rootLabel: path.basename(root) || root,
    rootPath: root,
    folders: [],
    groups: Object.create(null),
    skipped: [],
  };
  let fileCount = 0;

  async function visit(relative, parent) {
    const absolute = path.join(root, relative);
    const key = folderKey(relative);
    snapshot.folders.push({ key, label: relative ? path.basename(relative) : snapshot.rootLabel, parent });
    snapshot.groups[key] = [];
    let names;
    try {
      // Recheck before enumeration in case an entry changed since its parent.
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        if (!relative) throw new Error('Root changed during capture.');
        snapshot.skipped.push({ path: slash(relative), reason: 'link-or-changed-directory' });
        return;
      }
      names = await readdir(absolute);
    } catch (error) {
      if (!relative) throw error;
      snapshot.skipped.push({ path: slash(relative), reason: errorCode(error) });
      return;
    }

    for (const name of names.sort(compare)) {
      const childRelative = path.join(relative, name);
      const displayPath = slash(childRelative);
      let stat;
      try {
        stat = await lstat(path.join(root, childRelative));
      } catch (error) {
        snapshot.skipped.push({ path: displayPath, reason: errorCode(error) });
        continue;
      }
      if (stat.isSymbolicLink()) {
        snapshot.skipped.push({ path: displayPath, reason: 'symbolic-link-or-junction' });
      } else if (stat.isDirectory()) {
        await visit(childRelative, key);
      } else if (stat.isFile()) {
        const type = path.extname(name).slice(1).toUpperCase() || '文件';
        snapshot.groups[key].push({
          id: displayPath,
          name,
          note: `${formatSize(stat.size)} · ${type}`,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
        fileCount += 1;
      } else {
        snapshot.skipped.push({ path: displayPath, reason: 'not-a-regular-file-or-directory' });
      }
    }
  }

  await visit('', null);
  await mkdir(path.dirname(out), { recursive: true });
  await assertNoLinkedAncestors(out);
  await writeFile(out, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Snapshot saved: ${snapshot.folders.length} folders, ${fileCount} files, ${snapshot.skipped.length} skipped.`);
}

main().catch((error) => {
  // Filesystem errors can contain private filenames; report only their code.
  console.error(error.code ? `Snapshot failed (${errorCode(error)}).` : error.message);
  process.exitCode = 1;
});
