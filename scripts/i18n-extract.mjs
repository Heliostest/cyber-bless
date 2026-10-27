/**
 * Read-only registration drift checks, not a code migration or a cultural review.
 * Checks explicit translation/binding calls, literal JSX/DOM/Canvas copy, known
 * copy containers and bundled metadata. Dynamic user/remote expressions are
 * inventoried as unresolved, never guessed or translated by this tool.
 */
import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceCalls = new Set(['tr', 'translate', 'translateScene', 'sceneCopy', 'sceneProductCopy', 'sceneTemplate', 'productError', 'ProductError', 'assertSafeCopy']);
const translatedCalls = new Set([...sourceCalls, 'message', 'formatMessage', 'sceneJoin', 'formatNumber', 'formatDate']);
const textAttributes = new Set(['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'aria-braillelabel', 'aria-brailleroledescription', 'title', 'placeholder', 'alt', 'label']);
const textProperties = new Set(['textContent', 'innerText', 'innerHTML', 'title', 'placeholder']);
const copyContainers = /^(?:COPY|ACTIONS|HINTS|MOVING|FINISHING|READY|WISH_WRITE_COPY|sceneNarratives\w*|rituals)$/;
const technicalFields = new Set(['id', 'kind', 'type', 'key', 'code', 'engine', 'revision', 'manifestUrl', 'category', 'source', 'sensitivity', 'sceneId']);
const meaningful = source => /\p{Letter}/u.test(source);
const normalizeFile = file => file.replaceAll('\\', '/');
const unwrap = node => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
};
const propertyName = node => node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : undefined;

export function auditSourceText(file, text, registry) {
  file = normalizeFile(file);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const result = { messages: [], issues: [], exemptions: [], dynamic: [] };
  const seen = new Set();
  const aliases = new Map();
  const constants = new Map();
  for (const statement of sf.statements) if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const))
    for (const item of statement.declarationList.declarations) if (ts.isIdentifier(item.name) && item.initializer) constants.set(item.name.text, item.initializer);
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith('@wbr/')) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) aliases.set(item.name.text, item.propertyName?.text ?? item.name.text);
  }
  const callName = expression => {
    if (ts.isIdentifier(expression)) return aliases.get(expression.text) ?? expression.text;
    return ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
  };
  const location = node => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return { file, line: line + 1, column: character + 1 };
  };
  function record(kind, node, source, extra = {}) {
    const key = `${kind}:${node.getStart(sf)}:${source}:${extra.code ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key); result[kind].push({ ...location(node), source, ...extra });
  }
  function artifact(node, source) {
    if (file !== 'packages/app/src/scene-icons.tsx' || !/^[五大力運]+$/u.test(source)) return false;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent)) return parent.openingElement.tagName.getText(sf) === 'text';
    }
    return false;
  }
  function insideClass(node, name) {
    for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxElement(parent)) {
      if (parent.openingElement.attributes.properties.some(item => ts.isJsxAttribute(item) && item.name.getText(sf) === 'className' && item.initializer && ts.isStringLiteral(item.initializer) && item.initializer.text.split(/\s+/).includes(name))) return true;
    }
    return false;
  }
  function check(node, source, sink, raw = false) {
    if (!meaningful(source)) return; // Whitespace, punctuation and fixed numeric decoration.
    if (raw && source === 'MiB') { record('exemptions', node, source, { reason: 'IEC binary-size unit symbol', sink }); return; }
    if (raw && file === 'apps/cyber-bless/src/DebugOverlay.tsx' && source === 'THREE.JS') {
      record('exemptions', node, source, { reason: 'Three.js library name, displayed verbatim', sink }); return;
    }
    if (raw && file === 'packages/app/src/App.tsx' && sink === 'JSX:text' && source === 'CYBER BLESS · A LITTLE EVERY DAY' && insideClass(node, 'desktop-note')) {
      record('exemptions', node, source, { reason: 'Exact desktop brand lockup; adjacent product tagline is localized', sink }); return;
    }
    if (raw && artifact(node, source)) {
      record('exemptions', node, source, { reason: 'Original artifact inscription in the reviewed SVG drawing', sink });
      return;
    }
    const entries = registry.sources.get(source);
    if (entries?.length) record('messages', node, source, { id: entries[0].id, groups: entries.map(entry => entry.group), sink });
    if (raw) record('issues', node, source, { code: 'unlocalized-sink', sink, detail: 'Literal product text needs an explicit localized sink' });
    else if (!entries?.length) record('issues', node, source, { code: 'unmapped-source', sink, detail: 'Trusted literal is absent from registered source maps' });
  }
  function literalObject(node) {
    node = unwrap(node);
    if (node && ts.isIdentifier(node)) return unwrap(constants.get(node.text));
    return node;
  }
  function lexicalConstant(node, name) {
    for (let scope = node.parent; scope; scope = scope.parent) if (ts.isBlock(scope) || ts.isSourceFile(scope)) {
      for (const statement of scope.statements) if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
        const declaration = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name);
        if (declaration) return unwrap(declaration.initializer);
      }
    }
  }
  const activeExpressions = new Set();
  function expression(node, sink, raw = false) {
    node = unwrap(node);
    if (!node || activeExpressions.has(node)) return;
    activeExpressions.add(node);
    try { inspectExpression(node, sink, raw); } finally { activeExpressions.delete(node); }
  }
  function inspectExpression(node, sink, raw = false) {
    node = unwrap(node);
    if (!node) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { check(node, node.text, sink, raw); return; }
    if (ts.isConditionalExpression(node)) { expression(node.whenTrue, sink, raw); expression(node.whenFalse, sink, raw); return; }
    if (ts.isArrayLiteralExpression(node)) { node.elements.forEach(item => expression(item, sink, raw)); return; }
    if (ts.isTemplateExpression(node)) {
      const source = node.head.text + node.templateSpans.map((span, i) => `{p${i}}${span.literal.text}`).join('');
      if (file === 'packages/scene-runtime/src/interaction-cues.ts' && sink === 'DOM:innerHTML'
        && node.head.text === '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
        && node.templateSpans.length === 1 && node.templateSpans[0].literal.text === '</svg>' && node.templateSpans[0].expression.getText(sf) === 'icons[cue.kind]') {
        const icons = lexicalConstant(node, 'icons');
        if (icons && ts.isObjectLiteralExpression(icons) && icons.properties.every(item => ts.isPropertyAssignment(item) && ts.isStringLiteral(item.initializer)
          && !/\b(?:aria-label|aria-description|aria-valuetext|aria-roledescription|title)\s*=/i.test(item.initializer.text)
          && item.initializer.text.replace(/<(?:path|circle|line|polyline|polygon|rect|ellipse)\b[^>]*\/?\s*>/g, '').trim() === '')) {
          record('exemptions', node, source, { sink, reason: 'Exact interaction-cue SVG shell interpolates a checked table of geometry-only tags; no visible text' }); return;
        }
      }
      if (!meaningful(node.head.text + node.templateSpans.map(span => span.literal.text).join(''))) {
        record('dynamic', node, node.getText(sf), { sink, reason: 'Composition contains values and punctuation only; no language-dependent literal' }); return;
      }
      record('issues', node, source, { code: 'dynamic-source', sink, detail: 'Use a literal ICU template and named values rather than pre-interpolated text' });
      return;
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) {
      if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) expression(node.left, sink, raw);
      expression(node.right, sink, raw); return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const strings = [];
      const collect = part => { if (ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part)) strings.push(part.text); else if (ts.isBinaryExpression(part)) { collect(part.left); collect(part.right); } };
      collect(node);
      if (!strings.some(meaningful)) { record('dynamic', node, node.getText(sf), { sink, reason: 'Arithmetic or value composition without language-dependent literals' }); return; }
      record('issues', node, node.getText(sf), { code: 'dynamic-source', sink, detail: 'Compose complete registered messages with named parameters' }); return;
    }
    if (ts.isCallExpression(node) && translatedCalls.has(callName(node.expression))) return;
    if (ts.isIdentifier(node) && constants.has(node.text)) { expression(constants.get(node.text), sink, raw); return; }
    if (ts.isPropertyAccessExpression(node)) {
      const object = literalObject(node.expression);
      if (object && ts.isObjectLiteralExpression(object)) {
        const field = object.properties.find(item => ts.isPropertyAssignment(item) && propertyName(item.name) === node.name.text);
        if (field) { expression(field.initializer, sink, raw); return; }
      }
    }
    if (ts.isElementAccessExpression(node)) {
      const array = literalObject(node.expression);
      if (array && ts.isArrayLiteralExpression(array)) { expression(array, sink, raw); return; }
    }
    if (ts.isElementAccessExpression(node) && ts.isArrayLiteralExpression(unwrap(node.expression))) { expression(unwrap(node.expression), sink, raw); return; }
    record('dynamic', node, node.getText(sf), { sink, reason: 'Nonliteral expression: user, remote, derived or separately bound copy; no source inference' });
  }
  function copyTree(node, sink) {
    node = unwrap(node);
    if (!node) return;
    if (ts.isObjectLiteralExpression(node)) {
      for (const item of node.properties) if (ts.isPropertyAssignment(item) && !technicalFields.has(propertyName(item.name))) copyTree(item.initializer, sink);
    } else if (ts.isArrayLiteralExpression(node)) node.elements.forEach(item => copyTree(item, sink));
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isConditionalExpression(node)) expression(node, sink);
  }
  function objectFields(node, names, sink) {
    node = unwrap(node);
    if (!node || !ts.isObjectLiteralExpression(node)) return;
    for (const item of node.properties) if (ts.isPropertyAssignment(item) && names.has(propertyName(item.name))) expression(item.initializer, sink);
  }
  function jsxContainer(node) {
    return node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent));
  }
  function visit(node) {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const name = callName(node.expression), args = node.arguments ?? [];
      if (sourceCalls.has(name)) expression(args[0], name);
      else if (file === 'apps/cyber-bless/src/pages/Playground.tsx' && name === 'status') expression(args[0], 'gesture-status');
      else if (file === 'apps/cyber-bless/src/pages/Playground.tsx' && name === 'setSafeStatus') expression(args[1], 'gesture-status');
      else if (name === 'sceneJoin') args.forEach(arg => expression(arg, name));
      else if (name === 'bindSceneText' || name === 'setSafeText') expression(args[1], name);
      else if (name === 'bindSceneAttribute') expression(args[2], name);
      else if (name === 'createStepOverlay') objectFields(args[1], new Set(['title', 'stepsAria', 'action']), name);
      else if (name === 'addInteractionCue') objectFields(args[1], new Set(['label', 'targetLabel']), name);
      else if (name === 'message') {
        const id = unwrap(args[0]);
        if (id && ts.isStringLiteral(id) && !registry.ids.has(id.text)) record('issues', id, id.text, { code: 'unknown-message-id', sink: name });
      } else if (name === 'setAttribute' && args[0] && ts.isStringLiteral(args[0]) && textAttributes.has(args[0].text)) expression(args[1], `setAttribute:${args[0].text}`, true);
      else if (name === 'fillText' || name === 'strokeText') expression(args[0], name, true);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && copyContainers.test(node.name.text)) copyTree(node.initializer, node.name.text);
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (file === 'packages/core/src/daily-scenes.ts' && ['title', 'caption', 'steps'].includes(name)) expression(node.initializer, `metadata:${name}`);
      else if (file === 'packages/core/src/scene-intentions.ts' && ['label', 'action'].includes(name)) expression(node.initializer, `intention:${name}`);
      else if (/^packages\/scenes\/src\/[^/]+\/index\.ts$/.test(file) && ['title', 'caption', 'steps', 'description'].includes(name)) expression(node.initializer, `module:${name}`);
      else if (file === 'packages/content/src/bundled.ts' && name === 'instruction') expression(node.initializer, 'bundled-copy');
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && textProperties.has(node.left.name.text)) expression(node.right, `DOM:${node.left.name.text}`, true);
    if (ts.isJsxText(node)) {
      const source = node.text.split(/\r?\n/).map(part => part.trim()).filter(Boolean).join(' ');
      if (source) check(node, source, 'JSX:text', true);
    }
    if (ts.isJsxExpression(node) && jsxContainer(node) && node.expression) expression(node.expression, 'JSX:expression', true);
    if (ts.isJsxAttribute(node) && textAttributes.has(node.name.getText(sf)) && node.initializer) {
      const initializer = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      expression(initializer, `JSX:${node.name.getText(sf)}`, true);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return result;
}

export async function readRegistry(root) {
  const base = path.join(root, 'packages/i18n/src'), sources = new Map(), ids = new Set(), issues = [];
  const catalog = {};
  for (const file of (await readdir(path.join(base, 'catalogs/zh-Hans'))).filter(file => file.endsWith('.json')).sort()) Object.assign(catalog, JSON.parse(await readFile(path.join(base, 'catalogs/zh-Hans', file), 'utf8')));
  Object.keys(catalog).forEach(id => ids.add(id));
  const add = (source, id, group) => {
    if (!sources.has(source)) sources.set(source, []);
    sources.get(source).push({ id, group });
  };
  for (const file of (await readdir(base)).filter(file => file.endsWith('-source.json')).sort()) {
    const group = file.slice(0, -12), entries = JSON.parse(await readFile(path.join(base, file), 'utf8'));
    for (const [source, id] of Object.entries(entries)) {
      add(source, id, group);
      if (catalog[id] !== source) issues.push({ file: `packages/i18n/src/${file}`, line: 1, source, code: 'source-map-drift', detail: `Source ID ${id} does not match its zh-Hans catalog text` });
    }
  }
  for (const [id, source] of Object.entries(catalog)) if (id.startsWith('native.')) add(source, id, 'native');
  return { sources, ids, issues };
}

const excludedDirs = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'assets', 'fixtures', '__fixtures__', '__tests__']);
export async function auditWorkspace(root) {
  const registry = await readRegistry(root), files = [];
  async function walk(dir) {
    let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!excludedDirs.has(entry.name)) await walk(full); }
      else if (/\.tsx?$/.test(entry.name) && !/\.(?:test|spec|generated|d)\./.test(entry.name)) files.push(full);
    }
  }
  for (const entry of await readdir(path.join(root, 'packages'), { withFileTypes: true })) if (entry.isDirectory() && entry.name !== 'i18n') await walk(path.join(root, 'packages', entry.name, 'src'));
  await walk(path.join(root, 'apps'));
  const result = { files: files.length, messages: [], issues: [...registry.issues], exemptions: [], dynamic: [] };
  for (const full of files.sort()) {
    const fileResult = auditSourceText(normalizeFile(path.relative(root, full)), await readFile(full, 'utf8'), registry);
    for (const key of ['messages', 'issues', 'exemptions', 'dynamic']) result[key].push(...fileResult[key]);
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '..'), result = await auditWorkspace(root);
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`i18n: ${result.files} source files; ${result.messages.length} registered literal locations; ${result.exemptions.length} explicit artifact exemptions; ${result.dynamic.length} unresolved dynamic locations`);
    for (const issue of result.issues.slice(0, 40)) console.error(`${issue.file}:${issue.line}:${issue.column ?? 1} ${issue.code} [${issue.sink ?? 'registry'}] ${JSON.stringify(issue.source.length > 180 ? issue.source.slice(0, 180) + '…' : issue.source)}`);
    console.log('Scope: TS/TSX literal sinks, named copy containers and bundled metadata. Dynamic user/remote values, native generated resources, CSS, HTML files and cultural correctness require their separate checks.');
    if (result.issues.length) console.error(`${result.issues.length} extraction drift issues; no files were modified.`);
  }
  if (result.issues.length) process.exitCode = 1;
}
