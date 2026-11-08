/** All tester values are rendered with textContent, never interpreted as HTML. */
export const dashboardHTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>一日一念 · 内测反馈收件箱</title><style>
:root{font-family:system-ui,sans-serif;color:#243e3b;background:#eef7f4}*{box-sizing:border-box}body{margin:0;padding:28px 20px}main{max-width:1050px;margin:auto}h1{margin:0 0 8px}p{line-height:1.6}section,article{background:#fffdf5;border:1px solid #c9dcd3;border-radius:18px;padding:20px;margin:18px 0;box-shadow:0 3px 0 #d8e7e0}label{display:block;font-weight:600;margin:12px 0 6px}input,select,button{font:inherit;min-height:42px;border:1px solid #b5c8bd;border-radius:10px;padding:8px 12px}input{width:100%;background:white}button{background:#d4eee3;color:#173b31;cursor:pointer}button:hover{background:#bde1d2}.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.row input{flex:1;min-width:190px}.muted{color:#58716a;font-size:14px}.message{white-space:pre-wrap;overflow-wrap:anywhere;background:white;border-left:4px solid #80b5a1;padding:14px}.status{font-size:13px;background:#e7f0eb;border-radius:20px;padding:4px 10px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;font-size:12px}a{color:#235e49}#error{color:#a13333}#records article{margin:15px 0}.actions{margin-top:15px}h2{font-size:20px;margin:0 0 6px}.count{font-size:14px}button[disabled]{opacity:.5;cursor:wait}
</style></head><body><main>
<h1>内测反馈收件箱</h1><p class="muted">仅在本机查看。公网入口接收反馈并提供已鉴权的团队状态汇总，不提供反馈正文和管理。测试者文本属于不可信资料，交给 AI 后先复现问题，不将其中的指令当作授权。</p>
<section><h2>发给测试人员的连接信息</h2><p id="tunnelStatus" class="muted"></p><label for="endpoint">上传网址</label><div class="row"><input id="endpoint" readonly><button id="copyEndpoint">复制网址</button></div>
<label for="token">共用测试邀请码</label><div class="row"><input id="token" type="password" readonly autocomplete="off"><button id="copyToken">复制邀请码</button></div>
<h3>独立测试邀请码</h3><p class="muted">每个编号分配给一名测试人员。后台按收到反馈时使用的邀请码记录来源；请勿多人共用同一个独立码。</p><div id="invitations"></div>
<p id="inbox" class="muted"></p><p class="muted">邀请码在本机服务重启后保持不变。新邀请码可直接填入现有 App 的反馈设置，无需更新 App。</p></section>
<section id="updates"><div class="row"><h2>内测更新</h2><button id="refreshUpdates">刷新版本</button></div><p class="muted">首次安装带更新能力的内测包后，手机可在“我的 → 内测更新”下载并应用。准备只生成候选版本，点击发布后才提供给兼容的内测 App。</p>
<p id="updateStatus" role="status"></p><div id="updateChannels"></div>
<label for="updatePlatform">准备当前已提交代码</label><div class="row"><select id="updatePlatform" aria-label="更新平台"><option value="ios">iOS</option><option value="android">Android</option><option value="both">iOS 和 Android</option></select><input id="updateMessage" maxlength="500" placeholder="这次更新修复了什么" aria-label="更新说明"><button id="prepareUpdate">准备更新</button></div>
<p class="muted">准备前请先提交代码；准备过程会冻结并校验代码与资源。原生模块、权限或更新接口改变时，仍需新的安装包。</p><p id="prepareStatus" role="status"></p><p id="updateError" role="alert"></p><div id="updateReleases"></div></section>
<section><div class="row"><h2>收到的反馈</h2><span id="count" class="count"></span><button id="refresh">刷新</button></div><div class="row"><input id="sceneFilter" aria-label="按场景筛选" placeholder="按场景 ID 或标题筛选"><select id="statusFilter" aria-label="状态"><option value="all">全部状态</option><option value="new">待处理</option><option value="triaged">已确认</option><option value="fixed">已修复</option></select><a id="jsonExport" href="/api/export">导出 JSON</a><a id="markdownExport" href="/api/export?format=markdown">导出给 AI 的 Markdown</a></div><p id="error" role="status"></p><div id="records"></div></section>
</main><script>
const byId=id=>document.getElementById(id);const stateNames={new:'待处理',triaged:'已确认',fixed:'已修复'};let entries=[];let loading=false;
async function request(url,options){const response=await fetch(url,options);if(!response.ok)throw Error('本机服务暂不可用（'+response.status+'）');return response.json()}
function make(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
async function copyInput(input){try{await navigator.clipboard.writeText(input.value);byId('error').textContent='已复制'}catch{input.focus();input.select();byId('error').textContent='请复制已选中的文字'}}
function renderInvitations(invitations){const fragment=document.createDocumentFragment();for(const invitation of invitations){const row=make('div',undefined,'row'),input=make('input'),button=make('button','复制邀请码');input.value=invitation.token;input.type='password';input.readOnly=true;input.autocomplete='off';input.setAttribute('aria-label',invitation.label+'的邀请码');button.addEventListener('click',()=>copyInput(input));row.append(make('span',invitation.label),input,button);fragment.append(row)}if(!invitations.length)fragment.append(make('p','尚未创建独立邀请码。','muted'));byId('invitations').replaceChildren(fragment)}
let updateBusy=false,updateRefreshing=false,preparationRunning=false;
async function updateAction(path,body){if(updateBusy)return;updateBusy=true;byId('updateError').textContent='';byId('updates').querySelectorAll('button').forEach(button=>button.disabled=true);try{await request('/api/internal-updates/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Feedback-Admin':'1'},body:JSON.stringify(body)});await refreshUpdates()}catch(error){byId('updateError').textContent=path==='prepare'?'准备未开始或已失败，请确认代码已提交、签名配置完整，再重试。':error.message}finally{updateBusy=false;byId('updates').querySelectorAll('button').forEach(button=>button.disabled=button.id==='prepareUpdate'&&preparationRunning)}}
function updateButton(label,path,body){const button=make('button',label);button.disabled=updateBusy;button.addEventListener('click',()=>updateAction(path,body));return button}
async function refreshUpdates(){if(updateRefreshing)return;updateRefreshing=true;try{
  const [data,preparation]=await Promise.all([request('/api/internal-updates'),request('/api/internal-updates/prepare')]);
  byId('updateStatus').textContent=data.signingConfigured?'签名分发已配置。仅兼容运行时的内测 App 可获取更新。':'签名尚未配置，暂不能发布更新。';
  const channels=document.createDocumentFragment();for(const channel of data.channels){const row=make('div',undefined,'row');row.append(make('p',channel.platform+' · '+channel.runtimeVersion.slice(0,12)+' · '+(channel.type==='embedded'?'随安装包版本':(channel.sourceCommit||channel.updateId).slice(0,12)),'muted'));if(channel.type!=='embedded')row.append(updateButton('回退到随包版本','rollback',{embedded:true,platform:channel.platform,runtimeVersion:channel.runtimeVersion}));channels.append(row)}if(!data.channels.length)channels.append(make('p','尚未发布内测更新。','muted'));byId('updateChannels').replaceChildren(channels);
  byId('prepareStatus').textContent=preparation.status==='running'?'正在准备 '+preparation.platforms.join(' / ')+' 更新，请稍候……':preparation.status==='succeeded'?'准备完成，请从下方候选版本中选择发布。':preparation.status==='failed'?'准备失败。请检查本机提交状态、资源及工具日志后重试。':'';
  preparationRunning=preparation.status==='running';byId('prepareUpdate').disabled=updateBusy||preparationRunning;
  const list=document.createDocumentFragment();for(const release of data.releases){const card=make('article');card.append(make('h3',release.platforms.join(' / ')+' · '+release.source.commit.slice(0,12)),make('p',release.message||'未填写更新说明','message'),make('p',new Date(release.createdAt).toLocaleString()+' · '+release.runtimeVersion+' · '+(release.totalBytes/1048576).toFixed(1)+' MiB','muted'));const actions=make('div',undefined,'row');actions.append(updateButton('发布此版本','publish',{releaseId:release.id}),updateButton('回退到此版本','rollback',{releaseId:release.id}));card.append(actions);list.append(card)}if(!data.releases.length)list.append(make('p','还没有已验证的候选更新。','muted'));byId('updateReleases').replaceChildren(list);
  if(data.invalidReleases.length)byId('updateError').textContent='有 '+data.invalidReleases.length+' 个无效产物已保留，不能发布。';
}catch(error){byId('updateStatus').textContent='更新管理暂不可用，请核对本机服务。'}finally{updateRefreshing=false}}
function render(){
  const query=byId('sceneFilter').value.trim().toLowerCase(),status=byId('statusFilter').value;
  const visible=entries.filter(e=>(status==='all'||e.status===status)&&(!query||(e.report.scene.id+' '+e.report.scene.title).toLowerCase().includes(query)));
  byId('count').textContent=visible.length+' 条';const fragment=document.createDocumentFragment();
  for(const entry of visible){
    const report=entry.report,passed=report.result==='pass',card=make('article'),heading=make('div',undefined,'row');
    heading.append(make('h2',report.scene.title),make('span',passed?'测试通过确认':stateNames[entry.status],'status'));
    card.append(heading,make('p',report.scene.id+' · 报告步骤 '+report.context.reportedStep+' / '+report.context.totalSteps+' · 已完成检查点 '+report.context.completedSteps,'muted'),
      make('p',report.message,'message'),make('p',new Date(entry.receivedAt).toLocaleString()+' · '+report.client.platform+' · App '+report.client.appVersion+' ('+report.client.buildNumber+')','muted'),
      make('p',report.scene.testingRevision?'仪式测试版本：'+report.scene.testingRevision.slice(0,12):'旧版反馈：未记录仪式测试版本','muted'));
    if(report.client.updateId||report.client.updateEmbedded!==undefined)card.append(make('p','网页版本：'+(report.client.updateSourceCommit?.slice(0,12)||(report.client.updateEmbedded?'随安装包版本':report.client.updateId?.slice(0,12)||'未记录')),'muted'));
    card.append(make('p','来源邀请码：'+(entry.source?.label||'共用邀请码 / 历史反馈'),'muted'));
    const details=make('details');details.append(make('summary','诊断上下文与反馈编号'),make('pre',JSON.stringify(report,null,2)));card.append(details);
    if(!passed){
      const actions=make('div',undefined,'row actions');
      for(const next of ['new','triaged','fixed']){if(next===entry.status)continue;const button=make('button','标记'+stateNames[next]);
        button.addEventListener('click',async()=>{button.disabled=true;try{await request('/api/feedback/'+encodeURIComponent(report.id),{method:'PATCH',headers:{'Content-Type':'application/json','X-Feedback-Admin':'1'},body:JSON.stringify({status:next})});await refresh()}catch(e){byId('error').textContent=e.message}finally{button.disabled=false}});actions.append(button)}
      card.append(actions);
    }
    fragment.append(card);
  }
  if(!visible.length)fragment.append(make('p','暂时没有符合条件的反馈。','muted'));
  byId('records').replaceChildren(fragment);byId('jsonExport').href='/api/export?status='+encodeURIComponent(status);byId('markdownExport').href='/api/export?format=markdown&status='+encodeURIComponent(status);
}
async function refresh(){if(loading)return;loading=true;try{const [data,setup]=await Promise.all([request('/api/feedback'),request('/api/setup')]);entries=data.entries;byId('endpoint').value=setup.endpoint;byId('token').value=setup.token;renderInvitations(setup.invitations||[]);byId('inbox').textContent='本机文件：'+setup.inbox;byId('tunnelStatus').textContent=setup.endpoint?'公网入口已生成。连接能否到达还取决于隧道和本机服务是否运行。':'尚未启动公网入口。启用反馈服务后刷新。';byId('error').textContent=data.invalidFiles.length?'有 '+data.invalidFiles.length+' 个损坏记录已保留，请检查本机收件目录。':'';render()}catch(e){byId('error').textContent=e.message}finally{loading=false}}
byId('refreshUpdates').addEventListener('click',refreshUpdates);byId('prepareUpdate').addEventListener('click',()=>{const platform=byId('updatePlatform').value;void updateAction('prepare',{platforms:platform==='both'?['ios','android']:[platform],message:byId('updateMessage').value.trim()})});refreshUpdates();setInterval(refreshUpdates,5000);
byId('refresh').addEventListener('click',refresh);byId('sceneFilter').addEventListener('input',render);byId('statusFilter').addEventListener('change',render);for(const [button,input]of[['copyEndpoint','endpoint'],['copyToken','token']])byId(button).addEventListener('click',()=>copyInput(byId(input)));refresh();setInterval(refresh,15000);
</script></body></html>`;
