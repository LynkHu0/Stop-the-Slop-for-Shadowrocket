import test from 'node:test';import assert from 'node:assert/strict';
import {instructions,PROMPT_VERSION,settings} from '../src/common.js';import {modelRequest} from '../src/detector.js';
test('upstream primary question plus format only, direct transcript and separate cache version',()=>{
 assert.ok(instructions.startsWith('Is it AI-generated, yes or no?'));
 assert.doesNotMatch(instructions,/模板|口语|具体细节|formulaic|anecdotes|cadence/i);
 const text='字幕正文'.repeat(5000),body=modelRequest(text,settings('key=fixture'));
 assert.equal(body.messages[1].content,text.slice(0,15000));
 assert.equal(body.messages[0].content,instructions);
 assert.notEqual(PROMPT_VERSION,'zh-score-v3');assert.equal(PROMPT_VERSION,'upstream-jev-question-v1');
 assert.equal(body.thinking.type,'enabled');assert.equal(body.reasoning_effort,'high');
});
