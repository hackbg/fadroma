import { ok, equal, throws, rejects } from 'node:assert';
import { stdout, argv } from 'node:process';
import { setImmediate } from 'node:timers';
import { inspect } from 'node:util';
import type { Prototype } from './index.ts';
import { Log, traceConsole } from './Log.ts';
import Fn from './Fn.ts'
import * as Ansi from './Ansi.ts';
import { Error, withInfiniteStack, alignTrace } from './Err.ts';
import { spaced, lines, toString } from './String.ts';
import { merged } from './Obj.ts';
import { msec } from './Time.ts';

export default Test;
/** Define a test case. */
function Test (name: string, ...steps: (Test.Step|string)[]): Test.Step;
/** Define the root test case. */
function Test (meta: Fn.Main.Meta, name: string, ...steps: (Test.Step|string)[]): Test.Step;
/** Define a test case. */
function Test (...args: unknown[]): Test.Step {
  // If passed an object as 1st argument, consider that
  // to be the import.meta descriptor, and return a root
  // test case (test entrypoint).
  if (typeof args[0] === 'object') return Test.Suite(
    args[0], args[1] as string, ...args.slice(2) as Test.Step[]
  );
  // Otherwise, consider the 1st arg to be the name
  // and return a regular test case.
  return Test.the(
    args[0] as string, ...args.slice(1) as Test.Step[]
  );
}

/** Test internals. */
namespace Test {
  /** A test step takes two arguments: the result of the previous test step,
    * and a mutable test context; and returns a result. */
  export type Step <C extends Context = Context, A = unknown, B = A> =
    Fn.Reflects & ((_: A, __?: C) => Fn.Async<B>) & { skip?: boolean };
  /** Test stack and context. Passed to eacgh step as second argument. */
  export type Context    = Log & Test.Stack & Test.Result & Test.Options & Test.Categories;
  /** Test options. */
  export type Options    = { args?: string[], only?: string[], except?: string[] };
  /** Test category name. */
  export type State      = 'pass'|'fail'|'todo'|'idea'|'warn'|'skip'|'note';
  /** Test results by category.. */
  export type Categories = Record<State, Category>;
  /** Test stack frame. */
  export type Frame      = Fn.Name & { t0: number, index: number };
  /** Collection of test results. */
  export type Category   = Fn<[Step], Result> & { icon:    string
                                                , label:   string
                                                , color:   Fn<[string], string>
                                                , results: Result[] };
  /** Keeps track of nested steps. */
  export type Stack      = { stack: Frame[]
                           ; begin (index: number, step: Fn.Name): number
                           ; end   (index: number, step: Fn.Name, t0: number, t1: number,
                                    state: State, returned: unknown, threw: unknown): void; };
  /** Result of test step. */
  export type Result     = { tD:        number
                           , state:     State
                           , stack:     Frame[]
                           , substeps?: Result[]
                           , returned?: unknown
                           , threw?: { todo?: boolean } };
  /** Define test entrypoint. When test module is run (not imported),
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
  export function Suite (meta: Fn.Main.Meta, name: string, ...steps: (Step|string)[]) {
    const suite = the(name, ...steps);
    const enter = Fn.Main.is(meta, argv[1]);
    if (enter) setImmediate(async function runTestSuite () {
      const args = argv.slice(2);
      traceConsole();
      const context = await Test.Context({ args });
      try {
        // Run test suite, collecting results into test report.
        await withInfiniteStack(Step(suite), undefined, context);
      } finally {
        // Print test report.
        stdout.write('\n' + lines(Report({ context })) + '\n');
      }
    });
    return suite as Step;
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
  export function the <T extends Context, U> (
    name: string|null, step0?: Fn<unknown[], U>, step1?: Fn<[U, T], unknown>, ...steps: unknown[]
  ): Step<T, void>;
  export function the <T extends Context> (
    name: string|null, ...steps: (Step<T>|string)[]
  ): Step<T, void>;
  export function the <T extends Context> (
    name: string|null, ...steps: (Step<T>|string)[]
  ): Step<T, void> {
    if (steps.length === 0) return todo(name);
    const substeps: Step<T>[] = steps.map(Step);
    return Fn.Name(name, testStep, { steps });
    async function testStep (last: unknown, context: T): Promise<void> {
      let state: State = null, threw: Error, returned = last;
      if (substeps.length === 0)
        context.todo({ index: 1, name, t0: performance.now() });
      if (substeps.length === 1)
        await runStep(Fn.Name(substeps[0].name||name, substeps[0]));
      for (let index = 1; index <= substeps.length; index++) { 
        const step = substeps[index - 1];
        const stepName = substepName(name, step as { name?: string });
        await Fn.Name(stepName, runStep)(step, index);
      }
      async function runStep (step: Step<T>, index = 1) {
        const t0 = context.begin(index, step);
        try {
          returned = await step(returned, context);
          state ||= 'pass';
        } catch (error) {
          threw ||= Fn.Step(step, error);
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

  /** Confirm that return value of previous test step
    * is deeply, strictly equal to expected value. */
  export function equals <T extends Context, V> (value: V, info?: string|Error): Step<T, unknown> {
    return Fn.Name(`MUST equal ${inspect(value)}`, function mustEqual (last: unknown) {
      equal(value, last, info);
      return last;
    }, { value, info });
  }

  /** Confirm that value returned by previous test step is of given type.
    * Optionally, confirms other predicates about the value. */
  export function is <T extends Context> (t: null|undefined): Step<T, unknown>;
  export function is <T extends Context> (t: 'string', expected?: string): Step<T, unknown>;
  export function is <T extends Context> (t: 'number', expected?: number): Step<T, unknown>;
  export function is <T extends Context> (t: 'bigint', expected?: bigint): Step<T, unknown>;
  export function is <T extends Context> (t: 'boolean', expected?: string): Step<T, unknown>;
  export function is <T extends Context> (t: 'symbol', expected?: symbol): Step<T, unknown>;
  export function is <T extends Context> (t: 'function', expectedName?: string): Step<T, unknown>;
  export function is <T extends Context> (t: 'object', expectedConstructorName?: string): Step<T, unknown>;
  export function is <T extends Context> (t: 'object', ...steps: Step<T, unknown>[]): Step<T, unknown>;
  export function is <T extends Context> (proto: { [Symbol.hasInstance] (_: unknown): boolean }): Step<T, unknown>;
  export function is <T extends Context> (type: string|object, ...args: unknown[]): Step<T, unknown> {
    // TODO: refactor: early dispatch
    const name = `MUST be ${type}`;
    // call the returned function to assert
    return toString(`[${name}]`)(Fn.Name(name, function mustBe (value: unknown) {
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

  /** Confirm that object has key.
    * Optionally, confirm predicates about the value of that key. */
  export function has <T extends Context, X> (
    k: keyof X, value?: boolean|number|bigint|symbol|null|undefined): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, proto: { [Symbol.hasInstance] (_: unknown): boolean }): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, type: 'boolean',  value?: boolean, ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, type: 'number',   value?: number, ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, type: 'bigint',   value?: bigint, ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, type: 'symbol',   value?: symbol, ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, type: 'string',   value?: string, ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, type: 'function', name?: string,  ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, type: 'object',   ctor?: string,  ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (
    k: keyof X, ...check: Step<T, unknown>[]): Step<T, unknown>;
  export function has <T extends Context, X> (k: keyof X, ...args: Parameters<typeof has>):
    Step<T, unknown>;
  export function has <T extends Context, X> (props: Partial<X>):
    Step<T, unknown>;
  export function has <T extends Context, X> (...args: unknown[]):
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
        return toString(info)(Fn.Name(name, async function testHasProperty (object: X, context: T) {
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
        return toString(`[${name}]`)(Fn.Name(name, function testHasProperties (object: object) {
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
  export function includes <T extends Context, X> (item: X) {
    return Fn.Name(`MUST include ${inspect(item)}`,
      function mustInclude (object: { includes (_: X): boolean }, _: T) {
        ok(object && ((typeof object === 'string') ||
          ((typeof object === 'object') && (typeof object['includes'] === 'function'))),
          `no "includes" method in ${inspect(object)}`);
        ok(object.includes(item),
          `${inspect(item)} not included in ${inspect(object)}`)
        return object;
      }, { item })
  }

  export const todo = Fn.todo;
  /** Test category names. */
  const categories: State[] = ['pass', 'fail', 'todo', 'idea', 'warn', 'skip', 'note'];
  /** Create initial test context. */
  export function Context <T extends Context> (...contexts: Partial<T>[]) {
    return Fn.Seq(Log, Options, Categories, Stack)(merged(...contexts)) as Promise<T>;
  }
  /** Define result categories. */
  function Categories (context: Partial<Context> = {}) {
    context.pass = Category(context.stack, 'pass', `🟢`, Ansi.green,  'passed'  );
    context.fail = Category(context.stack, 'fail', `🔴`, Ansi.red,    'failed'  );
    context.todo = Category(context.stack, 'todo', `🟠`, Ansi.orange, 'tasks'   );
    context.warn = Category(context.stack, 'warn', `🟡`, Ansi.yellow, 'warnings');
    context.skip = Category(context.stack, 'skip', `🟣`, Ansi.purple, 'skipped' );
    context.idea = Category(context.stack, 'idea', `🔵`, Ansi.blue,   'ideas'   );
    context.note = Category(context.stack, 'note', `⚫️`, Ansi.dim,    'notes'   );
    return context;
  }
  /** Parse test filters. */
  function Options (context: Partial<Options> = {}) {
    context.args ??= [];
    context.only ??= context.args.filter(x=>(!x.startsWith('--'))&&(x[2]!=='!'));
    context.except ??= context.args?.filter(x=>x.startsWith('--!'));
    return context;
  }
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
  /** Define result category. */
  function Category (
    stack: Frame[], state: State, icon: string, color: Fn<[string], string>,
    label: string = state
  ): Category {
    const props = { state, icon, label, color, results: [],
      get count () { return props.results.length } };
    const info = () => `[Category: ${icon} ${color(state)} (${props.results.length})]`;
    return toString(info)(Fn.Name(state, function categorize (result: Partial<Result>): Result {
      result = { ...result, state, stack: [...stack||[]] };
      props.results.push(result);
      return result as Result;
    }, props)) as Category;
  }
  /** Collect summary of test results. */
  function Report ({ context, details = [] }) {
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
  /** Make sure each test step is a function.
    * When passed a string, automatically converts it to a step of type "todo". */
  function Step <T extends Context>(step: Step<T>|string) {
    if (typeof step === 'string') return todo(step);
    if (typeof step === 'function') return step;
    if (step) throw new Error(`invalid step: ${step}`);
  }
  function testIndex (stack: Frame[]) {
    return stack.map(s=>s.index).join('.')+'.';
  }
  function testNames (stack: Frame[]) {
    return stack.map(s=>s.name).join(': ');
  }
  function testLabel (stack: Frame[], col1 = 20, col2 = 40) {
    return [
      testIndex(stack).padEnd(col1),
      testNames(stack).padEnd(col2)
    ].join(' │ ');
  }
  function substepName (name?: string, step?: { name?: string }) {
    return [name, step?.name].filter(Boolean).join(': ') || Ansi.gray(7, '(unnamed)');
  }
}

// Reexport some assertion helpers:
export { ok, equal, throws, rejects };
