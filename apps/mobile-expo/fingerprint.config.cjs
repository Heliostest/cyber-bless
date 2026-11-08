const path = require('node:path');

// Git checks out these source formats with either LF or CRLF on our Windows/Mac hosts.
// Work on bytes so split UTF-8 sequences and every binary asset remain unchanged.
const textExtensions = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.rb', '.podspec', '.swift',
  '.m', '.mm', '.h', '.hpp', '.c', '.cc', '.cpp', '.kt', '.kts', '.java', '.gradle',
  '.properties', '.xml', '.plist', '.xcconfig', '.pbxproj', '.entitlements', '.modulemap',
  '.sh', '.bash', '.zsh', '.txt', '.md', '.yaml', '.yml', '.toml', '.lock', '.pem',
  '.xcworkspacedata', '.xcsettings',
]);
const textNames = new Set(['Podfile', 'Gemfile', '.gitignore', '.gitattributes']);
const trailingCR = new WeakMap();

// SDK 57's config loader excludes these toolchain JS modules before collecting
// plugin sources. Its Windows separator check misses them. Repeat only those
// JS exclusions at the later POSIX hashing stage; native @expo/ui stays covered.
const configTooling = [
  '@expo/config', '@expo/config-plugins', '@expo/image-utils', '@expo/json-file', '@expo/plist', '@expo/require-utils',
  'ajv', 'ajv-formats', 'ajv-keywords', 'ansi-styles', 'base64-js', 'big-integer', 'bplist-creator', 'chalk',
  'cross-spawn', 'debug', 'dotenv', 'dotenv-expand', 'escape-string-regexp', 'getenv', 'graceful-fs',
  'fast-deep-equal', 'fast-uri', 'has-flag', 'imurmurhash', 'isexe', 'jimp-compact', 'js-tokens', 'json5',
  'json-schema-traverse', 'lines-and-columns', 'ms', 'parse-png', 'path-key', 'picocolors', 'plist', 'pngjs',
  'require-from-string', 'resolve-from', 'sax', 'schema-utils', 'semver', 'shebang-command', 'shebang-regex',
  'signal-exit', 'simple-plist', 'slugify', 'stream-buffers', 'sucrase', 'supports-color', 'ts-interface-checker',
  'typescript', 'write-file-atomic', 'which', 'uuid', 'xcode', 'xml2js', 'xmlbuilder',
];

function fileHookTransform(source, chunk, isEndOfFile, encoding) {
  if (source.type !== 'file' || (!textExtensions.has(path.extname(source.filePath).toLowerCase()) && !textNames.has(path.basename(source.filePath)))) return chunk;
  const previousCR = trailingCR.get(source) === true;
  if (chunk === null) {
    trailingCR.delete(source);
    return previousCR ? Buffer.from([13]) : null;
  }
  const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding === 'buffer' ? 'utf8' : encoding);
  if (!bytes.length && !isEndOfFile) return Buffer.alloc(0);
  const output = Buffer.allocUnsafe(bytes.length + (previousCR ? 1 : 0));
  let length = 0;
  if (previousCR && bytes[0] !== 10) output[length++] = 13;
  trailingCR.delete(source);
  for (let index = 0; index < bytes.length; index++) {
    const byte = bytes[index];
    if (byte === 13 && bytes[index + 1] === 10) { output[length++] = 10; index++; }
    else if (byte === 13 && index === bytes.length - 1 && !isEndOfFile) trailingCR.set(source, true);
    else output[length++] = byte;
  }
  return output.subarray(0, length);
}

module.exports = {
  ignorePaths: [
    ...configTooling.map(name => `**/node_modules/${name}/**/*.{js,cjs,mjs}`),
    '**/node_modules/@babel/*/**/*.{js,cjs,mjs}',
    '**/node_modules/@jridgewell/*/**/*.{js,cjs,mjs}',
    '**/node_modules/expo/config/**/*.{js,cjs,mjs}',
    '**/node_modules/expo/config{,-plugins}.js',
  ],
  extraSources: [
    { type: 'file', filePath: '../../store/ios/Podfile.lock', reasons: ['frozenNativeDependencyLock'], overrideHashKey: 'cyber-bless:frozen-ios-pod-lock' },
    { type: 'file', filePath: 'widget-copy.generated.json', reasons: ['nativeWidgetCodeGeneration'], overrideHashKey: 'cyber-bless:native-widget-copy' },
  ],
  fileHookTransform,
};
