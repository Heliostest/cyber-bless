import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureCleanSource,prepareRelease} from './internal-updates/cli.mjs';
const repository=fileURLToPath(new URL('../',import.meta.url));
const failure=(status,message)=>Object.assign(Error(message),{status});
/** Fixed committed-source build pipeline; HTTP never supplies a path or command.
 * Preparing imports a verified candidate only. Publishing is a separate action. */
export function createInternalUpdatePreparation({service,options,captureSource=captureCleanSource,prepare=prepareRelease}) {
  let job={status:'idle'},running,starting=false;
  const get=()=>JSON.parse(JSON.stringify(job));
  return {
    get,
    async start(body){
      if(starting||job.status==='running')throw failure(409,'An update preparation job is already running');
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['platforms','message'].includes(key))||!Array.isArray(body.platforms)||body.platforms.length<1||body.platforms.length>2||new Set(body.platforms).size!==body.platforms.length||body.platforms.some(platform=>!['ios','android'].includes(platform))||body.message!==undefined&&(typeof body.message!=='string'||body.message.length>500||/[\x00-\x1f]/.test(body.message)))throw failure(400,'Invalid preparation selection');
      starting=true;
      let source;
      try{source=await captureSource(repository)}catch{throw failure(409,'Preparation requires clean committed source; commit current changes first')}finally{starting=false}
      const id=randomUUID(),platforms=[...body.platforms],message=body.message??'';
      job={id,status:'running',platforms,message,createdAt:new Date().toISOString(),sourceCommit:source.commit,releaseIds:[]};
      running=(async()=>{
        try{
          for(const platform of platforms){
            const before=await captureSource(repository);
            if(before.commit!==source.commit||before.tree!==source.tree)throw Error('Source changed during preparation');
            const outputDir=path.resolve(options.storageDir,'prepared',id,platform);
            await prepare({...options,repoDir:repository,outputDir,platform,message});
            const after=await captureSource(repository);
            if(after.commit!==source.commit||after.tree!==source.tree)throw Error('Source changed during preparation');
            const release=await service.importRelease(outputDir);job.releaseIds.push(release.id);
          }
          job={...job,status:'succeeded',finishedAt:new Date().toISOString()};
        }catch{job={...job,status:'failed',error:'prepare-failed',finishedAt:new Date().toISOString()}}
      })();
      return get();
    },
    async finished(){await running},
  };
}
