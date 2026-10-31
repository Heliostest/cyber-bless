import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertReleaseSource,assertSourceReceipt,sourceReceipt} from './source-identity.mjs';
import {assertReleaseLock,assertOfficialBuildRoot} from './release-lock.mjs';

export function assertCounterCompletion(config,manifest,done){
 assertSourceReceipt(done,manifest);
 if(done.buildNumber!==String(config.buildNumber)||done.appId!==config.appId||done.internalBuildState!=='IN_BETA_TESTING'||done.build?.processingState!=='VALID')throw Error('No verified TestFlight completion for this release');
}

export async function main(args=process.argv.slice(2)){
const [file,mode='status']=args;
if(!['status','sync'].includes(mode)||!path.isAbsolute(file??''))throw Error('Usage: counter.mjs <absolute-release-config> status|sync');
const config=JSON.parse(await readFile(file,'utf8'));
if(!path.isAbsolute(config.localOutput??'')||config.localOutput!==config.output)throw Error('Counter output must belong to this release');
assertOfficialBuildRoot(config.buildRoot);
await assertReleaseLock(config.buildRoot);
const {manifest}=await assertReleaseSource(config,{entrypoint:import.meta.url,allowPrebuildChanges:true,requirePrepared:mode==='sync'});
const {getEasProjectContext,easSdk}=await import('../eas-project-context.mjs');
const context=await getEasProjectContext();
const projectId=context.expo.extra.eas.projectId;
if(context.expo.ios.bundleIdentifier!==config.bundleIdentifier||context.eas.submit.production.ios.ascAppId!==config.appId||context.expo.version!==config.version)throw Error('EAS app identity mismatch');
const counterDoc='query ReleaseCounter($appId:String!,$platform:AppPlatform!,$applicationIdentifier:String!){app{byId(appId:$appId){id latestAppVersionByPlatformAndApplicationIdentifier(platform:$platform,applicationIdentifier:$applicationIdentifier){id storeVersion buildVersion runtimeVersion}}}}';
const buildsDoc='query ReleaseActiveBuilds($appId:String!,$offset:Int!,$limit:Int!,$filter:BuildFilter){app{byId(appId:$appId){id builds(offset:$offset,limit:$limit,filter:$filter){id platform status appIdentifier appBuildVersion}}}}';
async function query(doc,variables){const r=await context.graphqlClient.query(doc,variables,{requestPolicy:'network-only',noRetry:true}).toPromise();if(r.error)throw Error('EAS query failed; credentials withheld');return r.data.app.byId;}
async function counter(){const value=(await query(counterDoc,{appId:projectId,platform:'IOS',applicationIdentifier:config.bundleIdentifier})).latestAppVersionByPlatformAndApplicationIdentifier;if(value?.storeVersion!==config.version||!/^[1-9]\d*$/.test(value.buildVersion??''))throw Error('Invalid EAS counter');return value;}
async function active(){const statuses=['NEW','IN_QUEUE','IN_PROGRESS','PENDING_CANCEL'];const counts={};for(const status of statuses){const rows=(await query(buildsDoc,{appId:projectId,offset:0,limit:50,filter:{status}})).builds;if(!Array.isArray(rows))throw Error('Missing EAS active builds');counts[status]=rows.length;if(rows.length)throw Error('Active EAS builds require waiting before local version allocation');}return counts;}
const before=await counter(),activeCounts=await active();
if(mode==='status'&&BigInt(before.buildVersion)>=BigInt(config.buildNumber))throw Error('Requested build number is already allocated in EAS; choose and commit a new release input/tag');
const report={checkedAt:new Date().toISOString(),...sourceReceipt(manifest),projectId,bundleIdentifier:config.bundleIdentifier,mode,beforeCounter:before,activeCounts,counterChanged:false};
await mkdir(config.localOutput,{recursive:true});
if(mode==='sync'&&BigInt(before.buildVersion)<BigInt(config.buildNumber)){
 const done=JSON.parse(await readFile(path.join(config.localOutput,'testflight-completion.json'),'utf8'));
 assertCounterCompletion(config,manifest,done);
 const again=await counter();if(again.buildVersion!==before.buildVersion)throw Error('EAS counter changed concurrently');
 const journal=path.join(config.localOutput,'counter-journal.json');
 await writeFile(journal,JSON.stringify({startedAt:new Date().toISOString(),before:before.buildVersion,target:String(config.buildNumber),state:'STARTED'},null,2),{flag:'wx'});
 const input={appId:projectId,platform:'IOS',applicationIdentifier:config.bundleIdentifier,storeVersion:config.version,buildVersion:String(config.buildNumber),...(before.runtimeVersion==null?{}:{runtimeVersion:before.runtimeVersion})};
 const noRetry={mutation:(doc,vars,options)=>context.graphqlClient.mutation(doc,vars,{...options,noRetry:true})};
 await easSdk('graphql/mutations/AppVersionMutation.js').AppVersionMutation.createAppVersionAsync(noRetry,input);
 report.afterCounter=await counter();if(BigInt(report.afterCounter.buildVersion)<BigInt(config.buildNumber))throw Error('EAS counter update not read back');
 report.counterChanged=true;report.completedAt=new Date().toISOString();
 await writeFile(journal,JSON.stringify({startedAt:report.checkedAt,completedAt:report.completedAt,before:before.buildVersion,after:report.afterCounter.buildVersion,state:'CONFIRMED'},null,2));
}else{report.afterCounter=before;report.completedAt=new Date().toISOString();}
await writeFile(path.join(config.localOutput,mode==='sync'?'counter-sync.json':'counter-initial.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
