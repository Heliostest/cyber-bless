import{test}from'node:test';import assert from'node:assert/strict';import{validateCatalog,parseCatalog,validateCatalogGroups}from'./i18n-catalogs.mjs';
test('target-only catalog groups cannot evade validation or review hashes',()=>{
 assert.match(validateCatalogGroups({app:{}},{app:{},extra:{unknown:'text'}})[0],/unknown catalog group/);
 assert.deepEqual(validateCatalogGroups({app:{}},{app:{}}),[]);
});
test('plural and select semantics cannot collapse into number formatting',()=>{
 assert.match(validateCatalog({a:'{n, plural, =0 {} other {#条}}'},{a:'{n, number} notes'},'app','en').join('\n'),/plural structure/);
 assert.match(validateCatalog({a:'{x, select, yes {Yes} other {No}}'},{a:'{x}'},'app','en').join('\n'),/select structure/);
 assert.match(validateCatalog({a:'{n, plural, =0 {} other {#条}}'},{a:'{n, plural, one {# note} other {# notes}}'},'app','en').join('\n'),/=0/);
});
test('target plurals cover the locale grammar, including non-English cardinal rules',()=>{
 assert.match(validateCatalog({a:'{n}条'},{a:'{n, plural, other {# notes}}'},'app','en').join('\n'),/missing.*one/);
 assert.match(validateCatalog({a:'{n}条'},{a:'{n, plural, one {# note} other {# notes}}'},'app','fr').join('\n'),/missing.*many/);
 assert.deepEqual(validateCatalog({a:'{n}条'},{a:'{n, plural, other {#件}}'},'app','ja'),[]);
});
test('duplicate JSON IDs cannot be silently overwritten',()=>{
 assert.throws(()=>parseCatalog('{"a":"first","a":"second"}'),/duplicate message ID/);
 assert.deepEqual(parseCatalog('{"a":"first"}'),{a:'first'});
});
test('missing translations and extra IDs fail',()=>{const issues=validateCatalog({a:'Hi, {name}'},{b:'Hello'});assert.equal(issues.length,2);});
test('interpolation loss and invalid ICU fail',()=>{
 assert.match(validateCatalog({a:'Hello, {name}'},{a:'Bonjour'})[0],/argument mismatch/);
 assert.match(validateCatalog({a:'Hi'},{a:'{n, plural, one {one}}'})[0],/invalid ICU/);
});
test('plural grammar can differ without losing variables',()=>assert.deepEqual(validateCatalog({a:'{n} 条记录'},{a:'{n, plural, one {# note} other {# notes}}'}),[]));
test('explicit numeric arguments and markup cannot change type',()=>{
 assert.match(validateCatalog({a:'{n, number}'},{a:'{n}'})[0],/must be number/);
 assert.match(validateCatalog({a:'Text'},{a:'<b>Text</b>'})[0],/tag mismatch/);
});
test('long introductions must retain all paragraphs',()=>assert.match(validateCatalog({a:'First.\n\nSecond.'},{a:'Premier.'},'narratives')[0],/paragraph count/));
