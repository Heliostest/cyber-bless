import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import ts from 'typescript';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputPath = 'packages/app/src/scene-testing-revisions.generated.ts';
const slash = value => value.replaceAll('\\', '/');
const normalized = bytes => bytes.toString('utf8').replace(/\r\n?/g, '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, (_key, next) => next && typeof next === 'object' && !Array.isArray(next)
  ? Object.fromEntries(Object.keys(next).sort().map(key => [key, next[key]])) : next);
const ignored = file => /(?:^|\/)(?:test-feedback[^/]*|scene-testing-revisions\.generated\.ts)(?:\/|$)/.test(file) || /(?:\.test|\.spec)\.[^.]+$/.test(file);
const aggregate = new Set(['packages/scenes/src/index.ts', 'packages/scenes/src/registry.ts',
  'packages/core/src/index.ts', 'packages/core/src/daily-scenes.ts', 'packages/core/src/scene-intentions.ts',
  'packages/core/src/scene-steps.ts', 'packages/core/src/scene-narratives/index.ts',
  'packages/i18n/src/catalog-data.ts', 'packages/i18n/src/source-index.generated.ts', 'packages/i18n/src/message-types.generated.ts',
  'packages/app/src/scene-engines.ts', 'packages/app/src/scene-library.tsx', 'packages/app/src/context.tsx']);

/** Static runtime imports only. Type declarations and diagnostic reporters do not alter an interaction. */
function sourceDetails(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = new Set(), strings = new Set();
  const add = node => { if (node && ts.isStringLiteralLike(node)) imports.add(node.text); };
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (!clause?.isTypeOnly && (!clause || clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings) || clause.namedBindings.elements.some(element => !element.isTypeOnly))) add(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(element => !element.isTypeOnly))) add(node.moduleSpecifier);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (!node.arguments[0] || !ts.isStringLiteralLike(node.arguments[0])) throw Error(`Nonliteral scene dependency requires an explicit fingerprint root: ${file}`);
      add(node.arguments[0]);
    }
    if (ts.isStringLiteralLike(node)) strings.add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { imports: [...imports], strings };
}

/** Hash shared gameplay and finish/checkpoint semantics without the reporter form or its output data. */
export function gameplayHostSource(source) {
  const tree = ts.createSourceFile('scene-experience.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const diagnosticNames = new Set(['reporterOpen', 'setReporterOpen', 'feedbackEnabled', 'testingRevision']);
  const hasReporter = node => {
    let found = false;
    const visit = child => {
      if ((ts.isJsxSelfClosingElement(child) || ts.isJsxOpeningElement(child)) && child.tagName.getText(tree) === 'TestFeedbackOverlay') found = true;
      if (!found) ts.forEachChild(child, visit);
    }; visit(node); return found;
  };
  return tree.statements.filter(node => ts.isFunctionDeclaration(node) && ['ProceduralScene', 'LoadedScene', 'SceneExperience'].includes(node.name?.text)).map(node => {
    const transformed = ts.transform(node, [context => {
      const visit = current => {
        if (ts.isJsxExpression(current) && hasReporter(current)) return undefined;
        if (ts.isVariableStatement(current)) {
          const names = current.declarationList.declarations.flatMap(declaration => {
            if (ts.isIdentifier(declaration.name)) return [declaration.name.text];
            if (ts.isArrayBindingPattern(declaration.name)) return declaration.name.elements.filter(ts.isBindingElement).map(element => element.name.getText(tree));
            return [];
          });
          if (names.length && names.every(name => diagnosticNames.has(name))) return undefined;
        }
        return ts.visitEachChild(current, visit, context);
      }; return visit;
    }]);
    try { return printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], tree); }
    finally { transformed.dispose(); }
  }).join('\n');
}

async function exists(file) { try { return (await stat(file)).isFile(); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; } }

/** Resolve actual local runtime dependencies; failures must never silently preserve an obsolete test badge. */
export async function computeSceneTestingRevisions({ root, scenes, sharedRoots = [], sharedLeafRoots = [], translations = {}, externalVersions = {}, barriers = [], assetsForScene = () => [] }) {
  root = path.resolve(root);
  const blocked = new Set([...aggregate, ...barriers]), files = new Map(), packages = new Map();
  const read = async relative => {
    if (!files.has(relative)) files.set(relative, await readFile(path.join(root, relative)));
    return files.get(relative);
  };
  async function localFile(relative) {
    const absolute = path.resolve(root, relative);
    if (path.relative(root, absolute).startsWith('..')) throw Error(`Dependency escapes project: ${relative}`);
    for (const suffix of ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js']) {
      if (await exists(absolute + suffix)) return slash(path.relative(root, absolute + suffix));
    }
    throw Error(`Unresolved local scene dependency: ${relative}`);
  }
  async function resolve(specifier, from) {
    if (specifier.startsWith('.')) return { local: await localFile(path.join(path.dirname(from), specifier)) };
    if (specifier.startsWith('@wbr/')) {
      const [scope, name, ...subpath] = specifier.split('/'), packageName = `${scope}/${name}`;
      if (!packages.has(packageName)) {
        const folder = `packages/${name}`, json = JSON.parse(normalized(await read(`${folder}/package.json`)));
        packages.set(packageName, { folder, json });
      }
      const { folder, json } = packages.get(packageName), key = subpath.length ? `./${subpath.join('/')}` : '.';
      const target = json.exports?.[key] ?? (key === '.' ? json.main : undefined);
      if (typeof target !== 'string') throw Error(`Unresolved workspace scene export: ${specifier} in ${from}`);
      return { local: await localFile(path.join(folder, target)) };
    }
    if (specifier.startsWith('node:')) return {};
    const pieces = specifier.split('/'); return { external: specifier.startsWith('@') ? pieces.slice(0, 2).join('/') : pieces[0] };
  }
  const result = {};
  for (const scene of [...scenes].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    const seen = new Set(), parts = [], strings = new Set(), externals = new Set();
    async function walk(relative) {
      relative = slash(relative);
      if (seen.has(relative) || blocked.has(relative) || ignored(relative)) return;
      seen.add(relative);
      const bytes = await read(relative);
      const text = /\.(?:ts|tsx|js|mjs|json|css|glsl|wgsl|svg)$/.test(relative) ? normalized(bytes) : undefined;
      parts.push([relative, hash(text ?? bytes)]);
      if (!/\.(?:ts|tsx|js|mjs)$/.test(relative)) return;
      const details = sourceDetails(text, relative); for (const value of details.strings) strings.add(value);
      for (const specifier of details.imports) {
        // The registry barrel imports every independent ritual. Its selected branch is supplied as the scene root instead.
        if (specifier === '@wbr/scenes') continue;
        const target = await resolve(specifier, relative);
        if (target.local) await walk(target.local);
        if (target.external) externals.add(target.external);
      }
    }
    for (const entry of [...sharedRoots, ...(scene.roots ?? [])]) await walk(await localFile(entry));
    // Shared reducers are leaves: following their metadata imports would drag in
    // every scene's narrative, but their actual gameplay code must invalidate passes.
    for (const entry of sharedLeafRoots) {
      const relative = await localFile(entry);
      parts.push([relative, hash(normalized(await read(relative)))]);
    }
    for (const entry of await assetsForScene(scene, seen)) await walk(await localFile(entry));
    const metadata = scene.metadata ?? {};
    function metadataStrings(value) { if (typeof value === 'string') strings.add(value); else if (value && typeof value === 'object') for (const item of Object.values(value)) metadataStrings(item); }
    metadataStrings(metadata);
    const localeParts = {};
    const base = translations['zh-Hans'] ?? {};
    for (const [locale, catalog] of Object.entries(translations)) {
      localeParts[locale] = Object.fromEntries(Object.entries(catalog).filter(([id]) => id.startsWith(`scene.${scene.id}.`) || strings.has(id) || strings.has(base[id])).sort(([a], [b]) => a.localeCompare(b, 'en')));
    }
    const versions = Object.fromEntries([...externals].sort().map(name => [name, externalVersions[name] ?? 'unrecorded']));
    result[scene.id] = hash(stable({ schemaVersion: 1, metadata, files: parts.sort(([a], [b]) => a.localeCompare(b, 'en')), locales: localeParts, dependencies: versions }));
  }
  return result;
}

async function projectInputs(root) {
  // Fresh CLI processes are used by the dev watcher so Node's module cache cannot retain old metadata.
  const { builtInScenes } = await import(new URL('../packages/core/src/daily-scenes.ts', import.meta.url));
  const { sceneIntention } = await import(new URL('../packages/core/src/scene-intentions.ts', import.meta.url));
  const { sceneStepCount, sceneProgress } = await import(new URL('../packages/core/src/scene-steps.ts', import.meta.url));
  const translations = {};
  const catalogRoot = path.join(root, 'packages/i18n/src/catalogs');
  for (const locale of await readdir(catalogRoot)) {
    if (!(await stat(path.join(catalogRoot, locale))).isDirectory()) continue;
    const messages = {};
    for (const filename of (await readdir(path.join(catalogRoot, locale))).filter(file => file.endsWith('.json'))) Object.assign(messages, JSON.parse(await readFile(path.join(catalogRoot, locale, filename), 'utf8')));
    translations[locale] = messages;
  }
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const externalVersions = Object.fromEntries(Object.entries(lock.packages).filter(([key]) => /^node_modules\/(?:@[^/]+\/)?[^/]+$/.test(key)).map(([key, value]) => [key.slice('node_modules/'.length), { version: value.version, integrity: value.integrity }]));
  const engineTree = ts.createSourceFile('scene-engines.ts', normalized(await readFile(path.join(root, 'packages/app/src/scene-engines.ts'))), ts.ScriptTarget.Latest, true);
  const registryTree = ts.createSourceFile('registry.ts', normalized(await readFile(path.join(root, 'packages/scenes/src/registry.ts'))), ts.ScriptTarget.Latest, true);
  const engineLoaders = new Map(), sceneLoaders = new Map();
  const loaders = (tree, collect) => {
    const visit = node => { collect(node, tree); ts.forEachChild(node, visit); }; visit(tree);
  };
  loaders(engineTree, (node, tree) => { if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.name)) engineLoaders.set(node.name.text, node.initializer.getText(tree)); });
  loaders(registryTree, (node, tree) => { if (ts.isCaseClause(node) && ts.isStringLiteralLike(node.expression)) sceneLoaders.set(node.expression.text, node.getText(tree)); });
  const scenes = builtInScenes.map(entry => ({ id: entry.id,
    roots: entry.engine === 'woodfish@1'
      ? ['packages/app/src/woodfish.tsx', 'packages/app/src/woodfish-scene.ts', 'packages/app/src/woodfish-model.ts', 'packages/app/src/woodfish-motion.ts', 'packages/app/src/woodfish-input.ts', 'packages/app/src/content.tsx']
      : [`packages/scenes/src/${entry.id}/index.ts`, 'packages/app/src/procedural-scene.ts', 'packages/scenes/src/contract.ts', 'packages/scenes/src/scene-localization.ts'],
    metadata: { ...entry, intention: sceneIntention(entry.id) ?? null, steps: sceneStepCount(entry),
      engineLoader: engineLoaders.get(entry.engine), registryLoader: entry.engine === 'woodfish@1' ? null : sceneLoaders.get(entry.id),
      legacyProgress: Array.from({ length: Math.max(13, sceneStepCount(entry) + 1) }, (_, progress) =>
        sceneProgress({ ...entry, progress, steps: 3 })),
    },
  }));
  for (const scene of scenes) {
    if (!scene.metadata.engineLoader || (scene.id !== 'woodfish' && !scene.metadata.registryLoader)) throw Error(`Missing selected scene loader: ${scene.id}`);
  }
  const hostFile = await readFile(path.join(root, 'packages/app/src/scene-experience.tsx'), 'utf8');
  const hostGameplay = gameplayHostSource(hostFile);
  if (!hostGameplay.includes('ProceduralScene') || !hostGameplay.includes('LoadedScene')) throw Error('Missing scene gameplay host');
  const hostCopySources = [...sourceDetails(hostGameplay, 'scene-experience.tsx').strings].sort();
  for (const scene of scenes) Object.assign(scene.metadata, { gameplayHost: hostGameplay, hostCopySources });
  const { bundledWoodfishModel } = await import('./publish-scene-content.mjs');
  return { root, scenes, translations, externalVersions,
    sharedRoots: ['packages/scene-runtime/src/index.ts', 'packages/app/src/scene-visual-preference.ts', 'packages/scenes/src/scene-localization.ts'],
    sharedLeafRoots: ['packages/core/src/index.ts'], assetsForScene: (scene, seen) => [
    ...(seen.has('packages/scene-runtime/src/cozy-environment.ts') ? ['assets/environments/kloppenheim-06-sky-1k.hdr', 'assets/environments/kloppenheim-02-night-1k.hdr'] : []),
    ...(scene.id === 'woodfish' ? ['content/woodfish/bundled.json', `assets/${bundledWoodfishModel}`] : []),
  ] };
}

export async function generateSceneTestingRevisions({ check = false, root = projectRoot } = {}) {
  const revisions = await computeSceneTestingRevisions(await projectInputs(root));
  const output = '// Generated by scripts/scene-testing-revisions.mjs. Do not edit.\n' +
    '// Hashes describe interaction source, dependencies, selected copy and assets; not engine/save versions.\n' +
    `export const sceneTestingRevisions: Readonly<Record<string, string>> = ${JSON.stringify(revisions, null, 2)};\n`;
  const target = path.join(root, outputPath), current = await readFile(target, 'utf8').catch(() => '');
  if (check && current !== output) throw Error('Scene testing revisions are stale; run node scripts/scene-testing-revisions.mjs');
  if (!check && current !== output) await writeFile(target, output);
  return revisions;
}

/** A fresh process avoids cached TypeScript metadata while Vite keeps the real App alive. */
export function sceneTestingRevisionsPlugin() {
  return { name: 'scene-testing-revisions', configureServer(server) {
    let timer, child, dirty = false, closed = false;
    function run() {
      timer = undefined;
      if (closed) return;
      if (child) { dirty = true; return; }
      dirty = false;
      child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let errors = '';
      child.stderr.on('data', bytes => { errors += bytes.toString(); });
      child.once('error', error => { errors += error.message; });
      child.once('close', code => {
        child = undefined;
        if (code !== 0 && !closed) server.config.logger.error(`Scene testing revisions failed: ${errors.trim()}`);
        if (dirty && !closed) timer = setTimeout(run, 250);
      });
    }
    function changed(_event, absolute) {
      const relative = slash(path.relative(projectRoot, absolute));
      if (ignored(relative) || !/^(?:packages\/(?:app|core|scenes|scene-runtime|gestures|shared|content|i18n)\/src\/|assets\/|content\/woodfish\/|package-lock\.json$)/.test(relative)) return;
      // Catalog output itself is an aggregate; the authored locale JSONs trigger the relevant refresh.
      if (/packages\/i18n\/src\/(?:catalog-data|source-index\.generated|message-types\.generated)\.ts$/.test(relative)) return;
      clearTimeout(timer); timer = setTimeout(run, 350);
    }
    server.watcher.on('all', changed);
    server.httpServer?.once('close', () => { closed = true; clearTimeout(timer); child?.kill(); server.watcher.off('all', changed); });
  } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const revisions = await generateSceneTestingRevisions({ check: process.argv.includes('--check') });
  console.log(`Scene testing revisions ${process.argv.includes('--check') ? 'checked' : 'generated'}: ${Object.keys(revisions).length} rituals.`);
}
