import { mkdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const resolverName = /^\[CP-User\] \[Expo\] Resolve [A-Za-z][A-Za-z0-9_]* dSYM source maps$/;
const decode = value => typeof value === 'string' && value.startsWith('"') ? JSON.parse(value) : value;

export async function prepareReleaseDsyms(config, { run }) {
  for (const field of ['repo', 'output', 'nodeBinary']) {
    if (!path.isAbsolute(config[field] ?? '')) throw Error('Expected absolute dSYM preparation path: ' + field);
  }
  const ios = path.join(config.repo, 'apps/mobile-expo/ios');
  const pods = path.join(ios, 'Pods');
  const projectFile = path.join(pods, 'Pods.xcodeproj/project.pbxproj');
  if (await realpath(projectFile) !== projectFile) throw Error('dSYM project must not be symlinked');
  const project = require('xcode').project(projectFile);
  project.parseSync();
  const phases = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase ?? {})
    .filter(phase => phase && typeof phase === 'object' && resolverName.test(decode(phase.name)));
  if (!phases.length) throw Error('No generated Expo dSYM resolver phases');

  const stamps = path.join(config.output, 'prepare-dsym-stamps');
  await mkdir(stamps, { recursive: true });
  if (await realpath(stamps) !== stamps) throw Error('dSYM stamp directory must not be symlinked');
  const env = {
    PODS_ROOT: pods, PODFILE_DIR: ios,
    REACT_NATIVE_PATH: path.join(config.repo, 'node_modules/react-native'),
    NODE_BINARY: config.nodeBinary, CONFIGURATION: 'Release', DERIVED_FILE_DIR: stamps,
  };
  for (const [index, phase] of phases.entries()) {
    if (!['/bin/sh', '/bin/bash'].includes(decode(phase.shellPath))) throw Error('Unexpected Expo dSYM phase shell');
    const script = decode(phase.shellScript);
    if (typeof script !== 'string' || !script.trim()) throw Error('Missing Expo dSYM resolver script');
    await run('/bin/bash', ['-c', script], { cwd: pods, env, log: `prepare-dsym-${index}.log` });
  }
  return { phaseCount: phases.length };
}
