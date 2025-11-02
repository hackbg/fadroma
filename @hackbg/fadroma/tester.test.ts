import $ from "./tester.ts";
import { ok, equal } from './deps.ts';
const _ = undefined;
const { must: { be: is, have: has } } = $;
export default $.suite(import.meta, 'Tester',

  $.expect('Context', ()=>$.context(), is('object'),
    has('pass'), has('fail'), has('todo')),

  $.expect('Suite',
    $.expect('Empty', () => $.suite(null, 'Suite1'),
      is('function'), has('name', 'Suite1')),
    $.expect('One step',
      () => $.suite(null, 'Suite2', $.expect('Step')),
      is('function'), has('name', 'Suite2'), has('steps'),
      ({ returned: { steps: { length } } })=>equal(length, 1)),
    $.expect('Two steps',
      () => $.suite(null, 'Suite', $.expect('Step1'), $.expect('Step2')),
      is('function'), has('name', 'Suite'),
      ({ returned: { steps: { length } } })=>equal(length, 2))),

  $.expect('Expect',
    $.expect('Empty',
      () => $.expect('Expect0'),
      is('function'), has('name', 'Expect0')),
    $.expect('One step',
      () => $.expect('Expect1', () => {}),
      is('function'), has('name', 'Expect1'), has('steps'),
      ({ returned: { steps: { length } } })=>equal(length, 1)),
    $.expect('Two steps',
      () => $.expect('Expect2', () => {}, () => {}),
      is('function'), has('name', 'Expect2'), has('steps'),
      ({ returned: { steps: { length } } })=>equal(length, 2)),

    $.expect('Chaining', async function testChaining () {
      const returned = Symbol();
      const step     = $.expect('', () => { ok(true); return returned });
      const result   = await step($.context());
      equal(result.returned, returned); }),

    $.expect('RFC2119')),

  $.expect('Forbid'),

  $.expect('Matrix'));
