import test from 'node:test';
import assert from 'node:assert/strict';
import {createInternalUpdatePreparation} from './internal-update-preparation.mjs';
const source={commit:'a'.repeat(40),tree:'b'.repeat(40),dirty:false};
test('preparation owns one job, imports verified platform candidates and never publishes',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});const exports=[],imports=[];
  const coordinator=createInternalUpdatePreparation({service:{importRelease:async directory=>{imports.push(directory);return{id:'verified-'+imports.length}}},options:{storageDir:'artifacts/internal-updates/test-prepare'},captureSource:async()=>source,
    prepare:async options=>{exports.push(options);await gate}});
  const initial=await coordinator.start({platforms:['ios','android'],message:'scene fix'});assert.equal(initial.status,'running');
  await assert.rejects(coordinator.start({platforms:['ios']}),/running/);release();
  await coordinator.finished();const done=coordinator.get();assert.equal(done.status,'succeeded');assert.deepEqual(done.releaseIds,['verified-1','verified-2']);assert.deepEqual(exports.map(v=>v.platform),['ios','android']);assert.equal(exports[0].message,'scene fix');assert.equal(done.sourceCommit,source.commit);
});
test('preparation refuses dirty source, arbitrary options, duplicate platforms and runtime failure',async()=>{
  const options={storageDir:'artifacts/internal-updates/test-prepare'};
  const dirty=createInternalUpdatePreparation({service:{},options,captureSource:async()=>{throw Error('dirty')}});
  await assert.rejects(dirty.start({platforms:['ios']}),/committed/);
  const coordinator=createInternalUpdatePreparation({service:{importRelease:async()=>{throw Error('should not import')}},options,captureSource:async()=>source,prepare:async()=>{throw Error('private native error')}});
  for(const body of[{platforms:['ios'],command:'sh'},{platforms:['ios','ios']},{platforms:['other']},{platforms:['ios'],message:'x'.repeat(501)}])await assert.rejects(coordinator.start(body));
  await coordinator.start({platforms:['ios']});await coordinator.finished();assert.equal(coordinator.get().status,'failed');assert.equal(coordinator.get().error,'prepare-failed');assert.ok(!JSON.stringify(coordinator.get()).includes('private native error'));
});
test('preparation refuses to mix a later source commit into a multi-platform job',async()=>{
  let captures=0,imports=0;
  const coordinator=createInternalUpdatePreparation({service:{importRelease:async()=>{imports++;return{id:'unexpected'}}},options:{storageDir:'artifacts/internal-updates/test-prepare'},
    captureSource:async()=>++captures<3?source:{...source,commit:'c'.repeat(40)},prepare:async()=>{}});
  await coordinator.start({platforms:['ios','android']});await coordinator.finished();
  assert.equal(coordinator.get().status,'failed');assert.equal(imports,0);
});
