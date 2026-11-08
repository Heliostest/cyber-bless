import {mkdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {createPrivateKey,createPublicKey,X509Certificate} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {internalUpdateDefaults} from './internal-updates/cli.mjs';
const require=createRequire(import.meta.url);
const certificates=require('@expo/code-signing-certificates');
async function exists(file){try{const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Signing identity must be a regular file');return true}catch(error){if(error.code==='ENOENT')return false;throw error}}

async function assertOutsideGit(file) {
  // Resolve the closest existing parent before creating anything. A junction
  // outside the checkout can still point into a different Git worktree.
  let existing=path.resolve(file),suffix=[];
  while(true){
    try{existing=await realpath(existing);break}catch(error){
      if(error.code!=='ENOENT')throw error;
      const parent=path.dirname(existing);if(parent===existing)throw error;
      suffix.unshift(path.basename(existing));existing=parent;
    }
  }
  let parent=path.dirname(path.join(existing,...suffix));
  while(true){
    try{await lstat(path.join(parent,'.git'));throw Error('Signing private key must be outside Git working trees')}
    catch(error){if(error.code!=='ENOENT')throw error}
    const next=path.dirname(parent);if(next===parent)break;parent=next;
  }
}

/** Never replaces an established signing identity. Only the public certificate
 * belongs in source control; callers choose an external private-key location. */
export async function configureInternalUpdateKeys({privateKeyPath,certificatePath,now=new Date()}) {
  privateKeyPath=path.resolve(privateKeyPath);certificatePath=path.resolve(certificatePath);
  const repository=fileURLToPath(new URL('../',import.meta.url)),relative=path.relative(repository,privateKeyPath);
  if(!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative))throw Error('Signing private key must stay outside the repository');
  if(privateKeyPath===certificatePath)throw Error('Private key and public certificate need separate files');
  await assertOutsideGit(privateKeyPath);
  const hasKey=await exists(privateKeyPath),hasCertificate=await exists(certificatePath);
  if(hasCertificate&&!hasKey)throw Error('Existing certificate has no private key; restore the key instead of replacing trust');
  let privateKeyPEM,publicKeyPEM;
  if(hasKey){privateKeyPEM=await readFile(privateKeyPath,'utf8');publicKeyPEM=createPublicKey(createPrivateKey(privateKeyPEM)).export({format:'pem',type:'spki'}).toString()}
  else{const pair=certificates.convertKeyPairToPEM(certificates.generateKeyPair());privateKeyPEM=pair.privateKeyPEM;publicKeyPEM=pair.publicKeyPEM}
  let certificatePEM;
  if(hasCertificate)certificatePEM=await readFile(certificatePath,'utf8');
  else{
    const validityNotBefore=new Date(now.getTime()-60000),validityNotAfter=new Date(now);validityNotAfter.setUTCFullYear(validityNotAfter.getUTCFullYear()+10);
    certificatePEM=certificates.convertCertificateToCertificatePEM(certificates.generateSelfSignedCodeSigningCertificate({keyPair:certificates.convertKeyPairPEMToKeyPair({privateKeyPEM,publicKeyPEM}),validityNotBefore,validityNotAfter,commonName:'CyberBless Internal Updates'})).replace(/\r\n/g,'\n');
  }
  const certificate=new X509Certificate(certificatePEM),key=createPrivateKey(privateKeyPEM);
  if(!certificate.checkPrivateKey(key)||Date.parse(certificate.validFrom)>now.getTime()||Date.parse(certificate.validTo)<=now.getTime())throw Error('Invalid, expired or mismatched signing identity');
  if(!hasKey){await mkdir(path.dirname(privateKeyPath),{recursive:true});await writeFile(privateKeyPath,privateKeyPEM,{flag:'wx',mode:0o600})}
  if(!hasCertificate){await mkdir(path.dirname(certificatePath),{recursive:true});await writeFile(certificatePath,certificatePEM,{flag:'wx',mode:0o644})}
  return {privateKeyPath,certificatePath,fingerprint:certificate.fingerprint256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const configured=await configureInternalUpdateKeys(internalUpdateDefaults());
  console.log(`Internal update certificate ready. SHA-256 fingerprint: ${configured.fingerprint}`);
  console.log('Private signing key remains outside Git. Existing keys were not replaced.');
}
