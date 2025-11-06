import { suite, the, context, is, has } from "./tester.ts";

export default suite(import.meta, 'Tester',

  the('Context', () => { return context() },
    is('object'),
    has('pass', is('function')),
    has('fail', is('function')),
    has('todo', is('function'))),

  the('Suite',
    the('Empty', Suite0, is('function', 'Suite0')),
    the('One step',
      the('String', Suite1A, is('function', 'Suite1A'), has('steps', has('length', is('number', 1)))),
      the('Expect', Suite1B, is('function', 'Suite1B'), has('steps', has('length', is('number', 1))))),
    the('Two steps', Suite2, is('function', 'Suite2'),  has('steps', has('length', is('number', 2)))),
    the('Nesting',   Suite3, is('function', 'Suite3'),  has('steps', has('length', is('number', 2))))),

  the('Step',
    the('Empty',     Step0, is('function', 'Expect0')),
    the('One step',  Step1, is('function', 'Expect1'), has('steps', has('length', 1))),
    the('Two steps', Step2, is('function', 'Expect2'), has('steps', has('length', 2))),
    the('Nested',    Step3, is('function', 'Expect3'), has('steps', has('length', 2)))),

  the('Is',
    the('Function', () => is('function')(function(){})),
    the('Function', () => is('function', 'name')(function name (){}))),

  the('Has',
    the('Property', () => has('prop')({ prop: true })),
    the('Nesting',  () => (has('prop', has('sub')))({ prop: { sub: true } }))),

  the('Forbid'),

  the('Matrix'));

function Suite0 () {
  /** Example empty test suite: */
  return suite(null, 'Suite0');
};

function Suite1A () {
  /** Example test suite with one empty step. */
  return suite(null, 'Suite1A', 'Step');
};

function Suite1B () {
  /** Example test suite with one empty step. */
  return suite(null, 'Suite1B', the('Step'));
}

function Suite2 () {
  /** Example test suite with two empty steps: */
  return suite(null, 'Suite2', the('Step1'), the('Step2'));
}

function Suite3 () {
  return suite(null, 'Suite3', the('Step1'), the('Step2', the('Step3')));
}

function Step0 () {
  return the('Expect0');
}

function Step1 () {
  return the('Expect1', () => {})
}

function Step2 () {
  return the('Expect2', () => {}, () => {})
}

function Step3 () {
  return the('Expect3', () => {}, the('Expect4', () => {}))
}
