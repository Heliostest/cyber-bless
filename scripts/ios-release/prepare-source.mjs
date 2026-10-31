// Historical entry point retained only to prevent accidental dirty releases.
// Official releases now obtain their source directly from a pushed tag on Mac.
console.error('Worktree source archives are disabled. Commit and merge release inputs, push an annotated tag and its LFS objects, then run checkout-tag.mjs on the Mac. See scripts/ios-release/README.md.');
process.exitCode = 1;