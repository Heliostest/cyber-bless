import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,symlink,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {withInternalUpdates} from './internal-update-config.mjs';
import {configureInternalUpdateKeys} from './configure-internal-updates.mjs';

test('internal update config isolates formal builds and never embeds an invitation',()=>{
  const base={name:'App',slug:'app',extra:{eas:{projectId:'existing'}},ios:{bundleIdentifier:'existing.app'}};
  const internal=withInternalUpdates(base,{internalToolsEnabled:true,requested:'1'});
  assert.equal(internal.updates.enabled,true);assert.equal(internal.updates.checkAutomatically,'NEVER');assert.deepEqual(internal.runtimeVersion,{policy:'fingerprint'});
  assert.deepEqual(internal.extra.eas,base.extra.eas);assert.equal(internal.extra.internalUpdates.enabled,true);
  // SDK 57 only permits request-header overrides for keys embedded at build
  // time. Reserve the invitation key with an empty value, never a real token.
  assert.equal(internal.updates.requestHeaders['X-Feedback-Token'],'');
  const production=withInternalUpdates(base,{internalToolsEnabled:false,requested:'1'});assert.equal(production.updates.enabled,false);assert.equal(production.updates.url,undefined);
  assert.equal(withInternalUpdates(base,{internalToolsEnabled:true,requested:'0'}).updates.enabled,false);
  assert.equal(withInternalUpdates(base,{internalToolsEnabled:true}).updates.enabled,false);
});
test('key setup preserves identity, publishes only a certificate, and refuses mismatched keys',async()=>{
  const tmp=await mkdtemp(path.join(os.tmpdir(),'cyber-update-keys-'));
  const privateKeyPath=path.join(tmp,'external','key.pem'),certificatePath=path.join(tmp,'project','cert.pem');
  try{
    const first=await configureInternalUpdateKeys({privateKeyPath,certificatePath});
    const privateBefore=await readFile(privateKeyPath,'utf8'),certificateBefore=await readFile(certificatePath,'utf8');
    assert.match(certificateBefore,/BEGIN CERTIFICATE/);assert.doesNotMatch(certificateBefore,/PRIVATE KEY/);
    assert.ok(!certificateBefore.includes('\r'),'public certificate matches Git LF bytes on every preparation host');
    const second=await configureInternalUpdateKeys({privateKeyPath,certificatePath});assert.equal(first.fingerprint,second.fingerprint);assert.equal(await readFile(privateKeyPath,'utf8'),privateBefore);
    const other=await configureInternalUpdateKeys({privateKeyPath:path.join(tmp,'other','key.pem'),certificatePath:path.join(tmp,'other','cert.pem')});
    await writeFile(certificatePath,await readFile(other.certificatePath));
    await assert.rejects(configureInternalUpdateKeys({privateKeyPath,certificatePath}));assert.equal(await readFile(privateKeyPath,'utf8'),privateBefore);
  }finally{await rm(tmp,{recursive:true,force:true})}
});

test('key setup rejects another Git worktree and a junction into it before writing secrets',async()=>{
  const tmp=await mkdtemp(path.join(os.tmpdir(),'cyber-update-key-scope-'));
  try{
    const checkout=path.join(tmp,'other-checkout');await mkdir(checkout);
    await writeFile(path.join(checkout,'.git'),'gitdir: elsewhere');
    const alias=path.join(tmp,'alias');await symlink(checkout,alias,process.platform==='win32'?'junction':'dir');
    for(const parent of[checkout,alias]){
      const privateKeyPath=path.join(parent,'uncreated','key.pem'),certificatePath=path.join(tmp,'public.pem');
      await assert.rejects(configureInternalUpdateKeys({privateKeyPath,certificatePath}),/outside Git/);
      await assert.rejects(access(privateKeyPath));await assert.rejects(access(certificatePath));
    }
  }finally{await rm(tmp,{recursive:true,force:true})}
});
