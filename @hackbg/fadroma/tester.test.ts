import { suite, the, context, is, has } from "./tester.ts";
import { ok, equal } from './deps.ts';
export default suite(import.meta, 'Tester',

  the('Context', context, is('object'),
    has('pass'), has('fail'), has('todo')),

  the('Suite',

    the('Empty', () => suite(null, 'Suite1'),
      is('function'), has('name', 'Suite1')),

    the('One step',
      () => suite(null, 'Suite2', the('Step')),
      is('function'), has('name', 'Suite2'), has('steps'),
      ({ steps: { length } })=>equal(length, 1)),

    the('Two steps',
      () => suite(null, 'Suite', the('Step1'), the('Step2')),
      is('function'), has('name', 'Suite'),
      ({ steps: { length } })=>equal(length, 2)),

    the('Nested',
      () => suite(null, 'Suite', the('Step1'), the('Step2', the('Step3'))),
      is('function'), has('name', 'Suite'),
      ({ steps: { length } })=>equal(length, 2))),

  the('Step',

    the('Empty',
      () => the('Expect0'),
      is('function'), has('name', 'Expect0')),

    the('One step',
      () => the('Expect1', () => {}),
      is('function'), has('name', 'Expect1'), has('steps'),
      ({ steps: { length } })=>equal(length, 1)),

    the('Two steps',
      () => the('Expect2', () => {}, () => {}),
      is('function'), has('name', 'Expect2'), has('steps'),
      ({ steps: { length } })=>equal(length, 2)),

    the('Nested',
      () => the('Expect3', () => {}, the('Expect4', () => {})),
      is('function'), has('name', 'Expect3'), has('steps'),
      ({ steps: { length } })=>equal(length, 2))),

  the('RFC2119'),

  the('Forbid'),

  the('Matrix'));
