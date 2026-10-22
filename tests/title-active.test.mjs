import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
test('active 0.4.3 title package has configurable 1–100 concurrency and contains no image interception',async()=>{
 const root=new URL('../dist/NoAIText-iOS-Title-0.4.3/',import.meta.url),module=await readFile(new URL('NoAIText.Title.srmodule',root),'utf8');
 assert.match(module,/DeepSeek并发:10/);assert.match(module,/concurrent=\{\{\{DeepSeek并发\}\}\}&serial=false/);assert.match(module,/思考:true,强度:high/);
 assert.doesNotMatch(module,/hdslb|biliimg|script-path=Script\/NoAIText.Cover/);
 const files=await readdir(new URL('Script/',root));assert.deepEqual(files.sort(),['NoAIText.GrpcTitle.js','NoAIText.Session.js','NoAIText.Status.js','NoAIText.Title.js']);
});

import {settings} from '../src/common.js';
test('concurrency defaults to 10, preserves 1/10/100, and clamps outside range',()=>{
 assert.equal(settings('').concurrent,10);
 for(const n of [1,10,100])assert.equal(settings('concurrent='+n+'&serial=false').concurrent,n);
 assert.equal(settings('concurrent=101').concurrent,100);
 assert.equal(settings('concurrent=0').concurrent,1);
 assert.equal(settings('concurrent=broken').concurrent,10);
});
