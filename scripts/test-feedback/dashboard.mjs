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
<section><div class="row"><h2>收到的反馈</h2><span id="count" class="count"></span><button id="refresh">刷新</button></div><div class="row"><input id="sceneFilter" aria-label="按场景筛选" placeholder="按场景 ID 或标题筛选"><select id="statusFilter" aria-label="状态"><option value="all">全部状态</option><option value="new">待处理</option><option value="triaged">已确认</option><option value="fixed">已修复</option></select><a id="jsonExport" href="/api/export">导出 JSON</a><a id="markdownExport" href="/api/export?format=markdown">导出给 AI 的 Markdown</a></div><p id="error" role="status"></p><div id="records"></div></section>
</main><script>
const byId=id=>document.getElementById(id);const stateNames={new:'待处理',triaged:'已确认',fixed:'已修复'};let entries=[];let loading=false;
async function request(url,options){const response=await fetch(url,options);if(!response.ok)throw Error('本机服务暂不可用（'+response.status+'）');return response.json()}
function make(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
async function copyInput(input){try{await navigator.clipboard.writeText(input.value);byId('error').textContent='已复制'}catch{input.focus();input.select();byId('error').textContent='请复制已选中的文字'}}
function renderInvitations(invitations){const fragment=document.createDocumentFragment();for(const invitation of invitations){const row=make('div',undefined,'row'),input=make('input'),button=make('button','复制邀请码');input.value=invitation.token;input.type='password';input.readOnly=true;input.autocomplete='off';input.setAttribute('aria-label',invitation.label+'的邀请码');button.addEventListener('click',()=>copyInput(input));row.append(make('span',invitation.label),input,button);fragment.append(row)}if(!invitations.length)fragment.append(make('p','尚未创建独立邀请码。','muted'));byId('invitations').replaceChildren(fragment)}
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
byId('refresh').addEventListener('click',refresh);byId('sceneFilter').addEventListener('input',render);byId('statusFilter').addEventListener('change',render);for(const [button,input]of[['copyEndpoint','endpoint'],['copyToken','token']])byId(button).addEventListener('click',()=>copyInput(byId(input)));refresh();setInterval(refresh,15000);
</script></body></html>`;
