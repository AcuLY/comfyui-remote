import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as sass from 'primereact-theme-sass';
import { createThemeInputs, themeDensity } from '../src/theme/theme-inputs.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const upstream = path.join(project, 'src/theme/vendor/primereact-sass-theme');
const output = path.join(project, 'src/theme/primereact.css');
const sourceCommit = '0b17cdc8d1a5c89b2e7cf65b8431b85996385a41';
const touchQuery = '(width < 768px), (pointer: coarse)';

function tokenRules(css) {
  const rules = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let start = 0;
  let body = 0;
  let selector = '';
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{') {
      if (depth++ === 0) {
        selector = source.slice(start, i).trim();
        body = i + 1;
      }
    } else if (source[i] === '}' && --depth === 0) {
      if (/^:root(?:\[data-(?:theme|module)=['"][\w-]+['"]\])*$/.test(selector)) {
        const attrs = [...selector.matchAll(/\[data-(theme|module)=['"]([\w-]+)['"]\]/g)];
        const values = Object.fromEntries([...source.slice(body, i).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
        rules.push({ attrs: attrs.map((m) => [m[1], m[2]]), values });
      }
      start = i + 1;
    }
  }
  if (depth !== 0 || !rules.length) throw new Error('tokens.css must contain balanced, top-level :root token rules.');
  return rules;
}

function resolveTokens(rules, variant) {
  const values = {};
  for (const rule of rules.filter((rule) => rule.attrs.every(([name, value]) => variant[name] === value)).sort((a, b) => a.attrs.length - b.attrs.length)) {
    Object.assign(values, rule.values);
  }
  function resolve(name, trail = []) {
    if (!(name in values)) throw new Error(`Missing semantic token --${name}.`);
    if (trail.includes(name)) throw new Error(`Circular semantic token: ${[...trail, name].join(' -> ')}.`);
    return values[name].replace(/var\(\s*--([\w-]+)\s*\)/g, (_, reference) => resolve(reference, [...trail, name]));
  }
  return resolve;
}

async function compileTheme(rules, variant) {
  const token = resolveTokens(rules, variant);
  const variablesPath = path.join(upstream, `themes/lara/lara-${variant.theme}/_variables.scss`);
  const original = await readFile(variablesPath, 'utf8');
  // The locked upstream file ends with one :root export block. Its Sass declarations
  // remain unchanged; only the root exports are omitted from this in-memory module.
  const rootAt = original.indexOf('\n:root {');
  if (rootAt < 0 || original.indexOf('\n:root {', rootAt + 1) !== -1) {
    throw new Error(`Unexpected official variables structure: ${variablesPath}`);
  }
  const variables = original.slice(0, rootAt);
  const inputs = Object.entries(createThemeInputs(token, variant)).map(([name, value]) => `$${name}: ${value};`).join('\n');
  const density = themeDensity(variant.touch);
  const scope = `:where(:root[data-theme='${variant.theme}'][data-module='${variant.module}'])`;
  const source = `${inputs}
@import 'cm-theme-variables';
$colors: ();
${scope} {
  @import 'primereact-sass-theme/theme-base/components';
  @layer primereact {
    .p-component { line-height: 1.5; }
    .p-button, input.p-inputtext, .p-dropdown, .p-multiselect { min-height: ${density.controlHeight}; }
  }
}
`;
  const result = sass.compileString(source, {
    url: pathToFileURL(path.join(project, `src/theme/${variant.theme}-${variant.module}.scss`)),
    loadPaths: [path.dirname(upstream)],
    style: 'compressed',
    charset: false,
    importers: [{
      canonicalize(url) { return url === 'cm-theme-variables' ? new URL('cm-theme:variables') : null; },
      load(url) { return url.protocol === 'cm-theme:' ? { contents: variables, syntax: 'scss' } : null; },
    }],
  });
  return variant.touch ? `@media ${touchQuery}{${result.css}}` : result.css;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check') || args.length > 1) throw new Error('Usage: node scripts/build-theme.mjs [--check]');
  const snapshot = JSON.parse(await readFile(path.join(upstream, 'UPSTREAM.json'), 'utf8'));
  if (snapshot.repository !== 'https://github.com/primefaces/primereact-sass-theme' || snapshot.commit !== sourceCommit || snapshot.version !== '10.8.5' || !sass.info.startsWith('dart-sass\t1.63.6')) throw new Error('Expected the pinned official Sass snapshot 10.8.5 and Dart Sass 1.63.6. Restore the snapshot and use the committed lockfile.');
  for (const file of snapshot.files) {
    if (!/^(?:theme-base\/|themes\/lara\/lara-(?:light|dark)\/)[\w/.-]+\.scss$/.test(file.path) || file.path.split('/').includes('..')) throw new Error(`Invalid upstream source path: ${file.path}`);
    const source = (await readFile(path.join(upstream, file.path), 'utf8')).replace(/\r\n/g, '\n');
    if (createHash('sha256').update(source, 'utf8').digest('hex') !== file.sha256Lf) throw new Error(`Official Sass snapshot changed: ${file.path}. Restore the pinned source instead of editing vendor files.`);
  }
  const rules = tokenRules(await readFile(path.join(project, 'src/tokens.css'), 'utf8'));
  const blocks = [];
  for (const touch of [false, true]) {
    for (const theme of ['light', 'dark']) {
      for (const module of ['image', 'training']) blocks.push(await compileTheme(rules, { theme, module, touch }));
    }
  }
  const css = `/*! Generated by scripts/build-theme.mjs. Do not edit.
 * PrimeReact Sass theme 10.8.5, commit ${sourceCommit}.
 * Copyright (c) 2023 PrimeTek. MIT; see LICENSE.primereact-sass-theme.
 * Semantic inputs: ../tokens.css; mappings: ./theme-inputs.mjs.
 */
${blocks.join('\n')}
`;
  const bytes = Buffer.byteLength(css);
  const size = `${(bytes / 1024).toFixed(1)} KiB CSS, ${(gzipSync(css).length / 1024).toFixed(1)} KiB gzip`;
  if (args[0] === '--check') {
    const existing = await readFile(output, 'utf8').catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing?.replace(/\r\n/g, '\n') !== css) throw new Error('Generated PrimeReact theme is missing or stale. Run npm run theme:build.');
    console.log(`PrimeReact theme is current (${size}).`);
  } else {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, css, 'utf8');
    console.log(`Generated src/theme/primereact.css (${size}).`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
