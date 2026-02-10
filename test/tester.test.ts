#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import The from "../library/Test.ts";
const { is: Is, has: Has } = The;

export default The(import.meta, 'Tester',

  The('Context', () => { return The.Context() },
    Is('object'),
    Has('pass', Is('function')),
    Has('fail', Is('function')),
    Has('todo', Is('function'))),

  The('Suite',
    The('Empty', Suite0, Is('function', 'Suite0')),
    The('One step',
      The('String', Suite1A, Is('function', 'Suite1A'), Has('steps', Has('length', Is('number', 1)))),
      The('Expect', Suite1B, Is('function', 'Suite1B'), Has('steps', Has('length', Is('number', 1))))),
    The('Two steps', Suite2, Is('function', 'Suite2'),  Has('steps', Has('length', Is('number', 2)))),
    The('Nesting',   Suite3, Is('function', 'Suite3'),  Has('steps', Has('length', Is('number', 2))))),

  The('Step',
    The('Empty',     Step0, Is('function', 'Expect0')),
    The('One step',  Step1, Is('function', 'Expect1'), Has('steps', Has('length', 1))),
    The('Two steps', Step2, Is('function', 'Expect2'), Has('steps', Has('length', 2))),
    The('Nested',    Step3, Is('function', 'Expect3'), Has('steps', Has('length', 2)))),

  The('Is',
    The('Function', () => Is('function')(function(){})),
    The('Function', () => Is('function', 'name')(function name (){}))),

  The('Has',
    The('Property', () => Has('prop')({ prop: true })),
    The('Nesting',  () => (Has('prop', Has('sub')))({ prop: { sub: true } }))),

  The('Forbid'),

  The('Matrix')

);

/** Example empty test suite: */
function Suite0  () { return The(null, 'Suite0'); };
/** Example test suite with one empty step. */
function Suite1A () { return The(null, 'Suite1A', 'Step'); };
/** Example test suite with one empty step. */
function Suite1B () { return The(null, 'Suite1B', The('Step')); }
/** Example test suite with two empty steps: */
function Suite2  () { return The(null, 'Suite2', The('Step1'), The('Step2')); }
function Suite3  () { return The(null, 'Suite3', The('Step1'), The('Step2', The('Step3'))); }
function Step0   () { return The('Expect0'); }
function Step1   () { return The('Expect1', () => {}) }
function Step2   () { return The('Expect2', () => {}, () => {}) }
function Step3   () { return The('Expect3', () => {}, The('Expect4', () => {})) }
