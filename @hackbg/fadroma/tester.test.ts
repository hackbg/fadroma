import { testContext, testSuite, expect, forbid, matrix }  from "./tester.ts";
import { call } from './index.ts';
import { ok, equal } from './deps.ts';
const _ = undefined;
export default testSuite(import.meta, 'Tester',
  expect('Context', call(testContext, _)),
  expect('Suite',   call(testSuite, null, 'Suite', _)),
  expect('Expect',
    ()=>expect('Something'),
    ()=>expect('Something')(testContext()),
    expect('Chaining', testChaining)),
  expect('Forbid',  call(forbid, 'Something', () => {})),
  expect('Matrix',  call(matrix, 'Something', [])));

async function testChaining () {
  const returned = Symbol();
  const step     = expect('', () => { ok(true); return returned });
  const result   = await step(testContext());
  equal(result.returned, returned);
}
