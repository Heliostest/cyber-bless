import {it,expect} from 'vitest';
import {parseFeedbackHistoryQuery,parseFeedbackHistoryPage} from './test-feedback';
const item={id:'old-issue-123',createdAt:'2026-11-01T08:00:00.000Z',receivedAt:'2026-11-02T08:00:00.000Z',updatedAt:'2026-11-03T08:00:00.000Z',status:'fixed',message:'第2步拖动没有反应',reportedStep:2,totalSteps:3,revision:'bundled',testingRevision:'a'.repeat(64),platform:'ios',appVersion:'1.0.0',buildNumber:'28',updateSourceCommit:'b'.repeat(40)};
it('validates a narrow scene history query and old fixed feedback without exposing private extras',()=>{
 expect(parseFeedbackHistoryQuery({schemaVersion:1,type:'history',sceneId:'crane'}).sceneId).toBe('crane');
 const page={schemaVersion:1,sceneId:'crane',generatedAt:item.updatedAt,items:[item]};
 expect(parseFeedbackHistoryPage(page).items[0]?.message).toBe(item.message);
 for(const value of[{...page,token:'secret'},{...page,items:[{...item,source:{label:'private'}}]},{...page,items:[{...item,reportedStep:4}]},{...page,items:[item,item]},{...page,items:Array.from({length:21},(_,i)=>({...item,id:'issue-id-'+i}))}])expect(()=>parseFeedbackHistoryPage(value)).toThrow();
 for(const value of[{schemaVersion:1,type:'history',sceneId:'../private'},{schemaVersion:1,type:'history',sceneId:'crane',cursor:'../file'},{schemaVersion:1,type:'history',sceneId:'crane',limit:999}])expect(()=>parseFeedbackHistoryQuery(value)).toThrow();
});
