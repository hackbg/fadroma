import { testContext, testSuite, expect, forbid, matrix, must }  from "./tester.ts";
import { call } from './index.ts';
import { ok, equal } from './deps.ts';
const _ = undefined;
export default testSuite(import.meta, 'Tester',
  expect('Context',
    call(testContext, _),
    must.be('object'),
    must.have('pass')),

  expect('Suite',
    call(testSuite, null, 'Suite', _),
    must.be('function'),
    must.have('name', 'Suite'),
    must.have('steps')),

  expect('Expect',
    call(expect, 'Something', _),
    call(call(expect, 'Something'), testContext()),
    expect('Chaining', testChaining)),

  expect('Forbid',
    call(forbid, 'Something', () => {}),
    call(call(forbid, 'Something', () => {}), testContext())),

  expect('Matrix',
    call(matrix, 'Something', [])));

async function testChaining () {
  const returned = Symbol();
  const step     = expect('', () => { ok(true); return returned });
  const result   = await step(testContext());
  equal(result.returned, returned);
}
