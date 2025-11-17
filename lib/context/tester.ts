import type { Fn, Reflects, Async, Prototype, Meta } from '../index.ts';
import { Log } from './log.ts';
import { ok, equal, throws, rejects, stdout, exit, argv,
  setImmediate, inspect } from '../deps.ts';
import { Ansi, Error, Name, Seq, Step as toStep,
  spaced, lines, msec, toString, merged, isMain,
  todo, withInfiniteStack, alignTrace } from '../format.ts';
/** Test entrypoint. When test module is run (not imported),
  * tests in the `suite` run, and a report is printed.
  *
  * Uncaught errors fail the test, unless they have the `todo` property set.
  * Use `todo('...description...')` to scaffold future test cases and specify
  * the expected shape of your project.
  *
  * To define your tests: [the], [has], [is], [equals], [includes];
  * or pass functions which take `(lastValue, context)`.
  *
  * Example:
  *
  *     import { suite, the, todo, ok, equal } from '@hackbg/fadroma';
  *     export default suite(import.meta, 'my module',
  *       'strings are TODOs',
  *       the('empty tests are TODOs'),
  *       the('substeps do not throw',
  *         context => { ok(true, "unary assertion") },
  *         the('tests can nest', context => {
  *           equal(1, 1, "binary assertion")
  *         })));
  *
  **/
export function suite (meta: Meta, name: string, ...steps: (Step|string)[]) {
  const suite = the(name, ...steps);
  const enter = isMain(meta, argv[1]);
  if (enter) setImmediate(()=>testAndExit(suite, argv.slice(2)));
  return suite as Step;
};
/** Run single test step, then exit interpreter. */
async function testAndExit (test: Step, args: string[]) {
  const context = await Testing({ args });
  try {
    await testRun(test, args, context);
  } finally {
    stdout.write('\n' + lines(testReport({ context })) + '\n');
  }
}
/** Run test suite, collecting results into test report. */
const testRun = async <T extends Testing> (
  test: Step<T>, _args?: string[], context?: Async<T>
): Promise<{ context: Testing, result: Result }> => ({
  context: (context = await (context || Testing())) as T,
  result:  await withInfiniteStack(Step(test), undefined, context) as T
});
/** Test stack and context. Passed to eacgh step as second argument. */
export type Testing = Stack & Log & Result & Options & Categories;
/** Create empty test context. */
export const Testing = <T extends Testing> (...contexts: Partial<T>[]) =>
  Seq(Log, Options, Categories, Stack)(merged(...contexts)) as Promise<T>;
/** Test options. */
export type Options = { args?: string[], only?: string[], except?: string[] };
/** Parse test filters. */
function Options (context: Partial<Options> = {}) {
  context.args ??= [];
  context.only ??= context.args.filter(x=>(!x.startsWith('--'))&&(x[2]!=='!'));
  context.except ??= context.args?.filter(x=>x.startsWith('--!'));
  return context;
}
/** Test category name. */
export type State = 'pass'|'fail'|'todo'|'idea'|'warn'|'skip'|'note';
/** Test category names. */
const categories: State[] = ['pass', 'fail', 'todo', 'idea', 'warn', 'skip', 'note'];
/** Test results by category.. */
export type Categories = Record<State, Category>;
/** Define result categories. */
function Categories (context: Partial<Testing> = {}) {
  context.pass = Category(context.stack, 'pass', `🟢`, Ansi.green,  'passed'  );
  context.fail = Category(context.stack, 'fail', `🔴`, Ansi.red,    'failed'  );
  context.todo = Category(context.stack, 'todo', `🟠`, Ansi.orange, 'tasks'   );
  context.warn = Category(context.stack, 'warn', `🟡`, Ansi.yellow, 'warnings');
  context.skip = Category(context.stack, 'skip', `🟣`, Ansi.purple, 'skipped' );
  context.idea = Category(context.stack, 'idea', `🔵`, Ansi.blue,   'ideas'   );
  context.note = Category(context.stack, 'note', `⚫️`, Ansi.dim,    'notes'   );
  return context;
}
/** Keeps track of nested steps. */
export type Stack = {
  stack: Frame[];
  begin (index: number, step: Name): number;
  end (index: number, step: Name, t0: number, t1: number,
       state: State, returned: unknown, threw: unknown): void;
};
/** Define test stack. */
function Stack (context: Partial<Log & Categories & Stack> = {}) {
  context.stack ??= [];
  context.begin ??= (index, step) => {
    const t0 = performance.now();
    context.stack.push({ index, name: step.name, t0 });
    context.info(msec(t0).padStart(8), '⏳');
    return t0;
  };
  context.end ??= (index, step, t0, t1, state, returned, threw) => {
    const tD = t1 - t0;
    const label = testLabel(context.stack);
    const { icon, color } = context[state];
    context.log(color(msec(t1).padStart(8)),
      Ansi.gray(6+2*Math.max(0, Math.log10(tD)), '+'+msec(tD).padStart(8)),
      icon, color(label));
    const result = { index, name: step.name, t0, t1, tD, returned, threw };
    context[state](result);
    context.stack.pop();
  };
  return context;
}
/** Collects test results. */
export type Category = Fn<[Step], Result> & {
  icon: string, label: string, color: Fn<[string], string>, results: Result[]
};
/** Define result category. */
function Category (
  stack: Frame[], state: State, icon: string, color: Fn<[string], string>,
  label: string = state
): Category {
  const props = { state, icon, label, color, results: [],
    get count () { return props.results.length } };
  const info = () => `[Category: ${icon} ${color(state)} (${props.results.length})]`;
  return toString(info)(Name(state, function categorize (result: Partial<Result>): Result {
    result = { ...result, state, stack: [...stack||[]] };
    props.results.push(result);
    return result as Result;
  }, props)) as Category;
}
/** Collect summary of test results. */
function testReport ({ context, details = [] }) {
  let line = '';
  const thrown = new Set();
  for (const {threw, stack: origin} of context.fail.results) {
    const label = [testIndex(origin), testNames(origin)].join(' ');
    const { message, stack = '' } = threw || {};
    if (!thrown.has(threw)) {
      details.push(['\n 🔴', Ansi.red(label), message].join(' '));
      thrown.add(threw);
      details.push(stack.replace(message).split('\n')
        .map((x: string)=>x.trim())
        .filter((x: string)=>!(x.includes('(ext:')||x.includes(' (node:')))
        .map(alignTrace).join('\n '));
    }
  }
  for (const name of categories) {
    const category = context[name];
    const { icon, color, label } = category;
    line = line + spaced(` ${icon}`, color(`${context[name].count} ${label}`), '');
  }
  details.push(line);
  return details;
}
/** Test stack frame. */
export type Frame = Name & { t0: number, index: number };
/** Test step. */
export type Step <C extends Testing = Testing, A = unknown, B = A> =
  Reflects & ((_: A, __?: C) => Async<B>) & { skip?: boolean };
/** Ensure test step is function. */
function Step <T extends Testing>(step: Step<T>|string) {
  if (typeof step === 'string') return todo(step);
  if (typeof step === 'function') return step;
  if (step) throw new Error(`invalid step: ${step}`);
}
/** Result of test step. */
export type Result = {
  tD:        number,
  state:     State,
  stack:     Frame[],
  substeps?: Result[],
  returned?: unknown,
  threw?:  { todo?: boolean },
};
/** Test case. Consists of name and zero or more test steps.
  *
  *   1. Steps run in sequence. If no step throws, the case passes.
  *   2. **Empty case** like `the('empty')`
  *      amounts to `the('empty', todo())`.
  *   3. **Stringy step** like `the('empty', 'string')`
  *      amounts to `the('empty', the('string'))`
  *   4. **Falsy step** like `the('something', null)` is only counted.
  *
  * Example:
  *
  *     import { suite, the, ok, equal } from '@hackbg/fadroma';
  *
  *     export const test1 = the('Thing',
  *       _ => ok(1 == 1)                       // unnamed step (sync)
  *       async _ => ok(await something() != 5) // unnamed step (async)
  *     );
  *
  *     export const test2 = the('Other',
  *       test1,                                // include defined substep
  *       the('named step', _ => equal(1, 1)),  // define named substep in place
  *       the('renamed step', test1)            // rename defined substep
  *     );
  *
  *     export default suite(import.meta, 'Test suite', test2);
  *
  **/
export function the <T extends Testing, U> (
  name: string|null, step0?: Fn<unknown[], U>, step1?: Fn<[U, T], unknown>, ...steps: unknown[]
): Step<T, void>;
export function the <T extends Testing> (
  name: string|null, ...steps: (Step<T>|string)[]
): Step<T, void> {
  if (steps.length === 0) return todo(name);
  const substeps: Step<T>[] = steps.map(Step);
  return Name(name, testStep, { steps });
  async function testStep (last: unknown, context: T): Promise<void> {
    let state: State = null, threw: Error, returned = last;
    if (substeps.length === 0)
      context.todo({ index: 1, name, t0: performance.now() });
    if (substeps.length === 1)
      await runStep(Name(substeps[0].name||name, substeps[0]));
    for (let index = 1; index <= substeps.length; index++) { 
      const step = substeps[index - 1];
      const stepName = substepName(name, step as { name?: string });
      await Name(stepName, runStep)(step, index);
    }
    async function runStep (step: Step<T>, index = 1) {
      const t0 = context.begin(index, step);
      try {
        returned = await step(returned, context);
        state ||= 'pass';
      } catch (error) {
        threw ||= toStep(step, error);
        if (!threw.todo) state = 'fail';
        if (state === 'fail') throw threw;
      } finally {
        const t1 = performance.now();
        state ||= 'todo';
        context.end(index, step, t0, t1, state, returned, threw);
      }
    }
  }
}
const testIndex = (stack: Frame[]) => stack.map(s=>s.index).join('.')+'.';
const testNames = (stack: Frame[]) => stack.map(s=>s.name).join(': ');
const testLabel = (stack: Frame[], col1 = 20, col2 = 40) => [
  testIndex(stack).padEnd(col1),
  testNames(stack).padEnd(col2)
].join(' │ ');
const substepName = (name?: string, step?: { name?: string }) =>
  [name, step?.name].filter(Boolean).join(': ') || Ansi.gray(7, '(unnamed)');
/** Confirm that value returned by previous test step is of given type.
  * Optionally, confirms other predicates about the value. */
export function is <T extends Testing> (t: null|undefined): Step<T, unknown>;
export function is <T extends Testing> (t: 'string', expected?: string): Step<T, unknown>;
export function is <T extends Testing> (t: 'number', expected?: number): Step<T, unknown>;
export function is <T extends Testing> (t: 'bigint', expected?: bigint): Step<T, unknown>;
export function is <T extends Testing> (t: 'boolean', expected?: string): Step<T, unknown>;
export function is <T extends Testing> (t: 'symbol', expected?: symbol): Step<T, unknown>;
export function is <T extends Testing> (t: 'function', expectedName?: string): Step<T, unknown>;
export function is <T extends Testing> (t: 'object', expectedConstructorName?: string): Step<T, unknown>;
export function is <T extends Testing> (t: 'object', ...steps: Step<T, unknown>[]): Step<T, unknown>;
export function is <T extends Testing> (proto: { [Symbol.hasInstance] (_: unknown): boolean }): Step<T, unknown>;
export function is <T extends Testing> (type: string|object, ...args: unknown[]): Step<T, unknown> {
  // TODO: refactor: early dispatch
  const name = `MUST be ${type}`;
  // call the returned function to assert
  return toString(`[${name}]`)(Name(name, function mustBe (value: unknown) {
    // type check
    ok(typeof value === type, `not ${type}: ${inspect(value, { depth: 4 })}`);
    // value check
    if (args.length >= 1) {
      // 1st arg after type is type-specific predicate
      const [arg] = args;
      if (type === 'object') {
        // object prototype check
        if (typeof arg === 'string') {
          // by constructor name as string:
          equal(Object.getPrototypeOf(value).constructor.name, arg);
        } else if (
          typeof arg === 'object' &&
          typeof arg[Symbol.hasInstance] === 'function'
        ) {
          // using the `instanceof` operator:
          ok(value instanceof (arg as Prototype));
        } else {
          throw new Error('unsupported object predicate');
        }
      } else if (type === 'function') {
        // function name check
        if (typeof arg === 'string') {
          equal((value as Fn).name, arg);
        } else {
          throw new Error('unsupported function predicate');
        }
      } else if (type === 'string' || type === 'number' || type === 'bigint' || type === 'symbol') {
        equal(value, arg);
      } else {
        throw new Error(`unsupported type predicate: ${type} ${arg}`);
      }
    }
    return value;
  })) as Step<T, unknown>;
}
/** Confirm that return value of previous test step
  * is deeply, strictly equal to expected value. */
export function equals <T extends Testing, V> (value: V, info?: string|Error): Step<T, unknown> {
  return Name(`MUST equal ${inspect(value)}`, function mustEqual (last: unknown) {
    equal(value, last, info);
    return last;
  }, { value, info });
}
/** Confirm that object has key.
  * Optionally, confirm predicates about the value of that key. */
export function has <T extends Testing, X> (
  k: keyof X, value?: boolean|number|bigint|symbol|null|undefined): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, proto: { [Symbol.hasInstance] (_: unknown): boolean }): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, type: 'boolean',  value?: boolean, ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, type: 'number',   value?: number, ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, type: 'bigint',   value?: bigint, ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, type: 'symbol',   value?: symbol, ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, type: 'string',   value?: string, ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, type: 'function', name?: string,  ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, type: 'object',   ctor?: string,  ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (
  k: keyof X, ...check: Step<T, unknown>[]): Step<T, unknown>;
export function has <T extends Testing, X> (k: keyof X, ...args: Parameters<typeof has>):
  Step<T, unknown>;
export function has <T extends Testing, X> (props: Partial<X>):
  Step<T, unknown>;
export function has <T extends Testing, X> (...args: unknown[]):
  Step<T, unknown>
{
  const arg0Type = typeof args[0];
  switch (true) {
    case (['string','number','symbol'].includes(arg0Type)): {
      // check for one key
      const key    = args[0] as keyof X;
      const checks = args.slice(1);
      const name   = `MUST have "${String(key)}"`
      const info   = `[${name}]`;
      return toString(info)(Name(name, async function testHasProperty (object: X, context: T) {
        ok(key in (object as object), `${String(key)} missing in ${inspect(object)}`);
        for (const check of checks) {
          if (typeof check !== 'function') {
            context.warn('check is not a function, ignoring:', check);
            continue
          }
          await check(object[key as keyof typeof object], context);
        }
        return object;
      })) as Step<T, unknown>;
    };
    case (args[0] && typeof args[0] === 'object'): {
      // partial equal
      const name = `MUST match "${inspect(args[0])}"`;
      return toString(`[${name}]`)(Name(name, function testHasProperties (object: object) {
        for (const [k, expected] of Object.entries(args[0])) {
          const actual = object[k]
          equal(actual, expected, `${k} = ${inspect(actual)} != ${inspect(expected)}`);
        }
        return object;
      })) as Step<T, unknown>;
    };
    default: throw new Error('has: invalid argument', { args });
  }
}
/** Confirm that string or array includes an expected value. */
export function includes <T extends Testing, X> (item: X) {
  return Name(`MUST include ${inspect(item)}`,
    function mustInclude (object: { includes (_: X): boolean }, _: T) {
      ok(object && ((typeof object === 'string') ||
        ((typeof object === 'object') && (typeof object['includes'] === 'function'))),
        `no "includes" method in ${inspect(object)}`);
      ok(object.includes(item),
        `${inspect(item)} not included in ${inspect(object)}`)
      return object;
    }, { item })
}
// Reexport some default assertions:
export { ok, equal, throws, rejects, todo };
