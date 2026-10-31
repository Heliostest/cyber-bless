import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkoutTagSource, ensureBuildRoot, DEFAULT_REPOSITORY_URL } from './git-source.mjs';
import { assertOfficialBuildRoot, withReleaseLock } from './release-lock.mjs';

export async function main(args = process.argv.slice(2)) {
  const parsed = {};
  for (const arg of args) {
    const match = /^--(tag|root)=([\s\S]+)$/.exec(arg);
    if (!match || parsed[match[1]]) throw Error('Usage: checkout-tag.mjs --tag=<annotated-tag> --root=/Users/heli/ios-builds/cyber-bless');
    parsed[match[1]] = match[2];
  }
  if (!parsed.tag || !parsed.root) throw Error('Usage: checkout-tag.mjs --tag=<annotated-tag> --root=/Users/heli/ios-builds/cyber-bless');
  assertOfficialBuildRoot(parsed.root);
  const buildRoot = await ensureBuildRoot(parsed.root);
  const result = await withReleaseLock(buildRoot, () => checkoutTagSource({
    repositoryUrl: DEFAULT_REPOSITORY_URL, tag: parsed.tag, buildRoot,
  }));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
