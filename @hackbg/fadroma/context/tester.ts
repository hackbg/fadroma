import type { Fn, Log, Reflects, Async, Prototype, Meta } from '../index.ts';
import { ok, equal, throws, rejects, stdout, exit, argv,
  setImmediate, inspect } from '../deps.ts';
import { ANSI, spaced, lines, msec, toString, merge, call, reflect, todo,
  Error, addStepStack, withInfiniteStack } from '../format.ts';
import { isEntrypoint } from './command.ts';
import { logger } from './logger.ts';

export {
  testContext  as context,
  testRun      as run,
  testThe      as the,
  testSuite    as suite,
  testReport   as report,
  testHas      as has,
  testCompare  as is,
  testEquals   as equals,
  testIncludes as includes,
  testForbid   as forbid, 
  call, ok, equal, throws, rejects, todo,
};

/** Test step. */
export type Step <C extends Context = Context, A = unknown, B = A> =
  Reflects & ((_: A, __?: C) => Async<B>) & { skip?: boolean };

/** Test stack and context. Passed to eacgh step as second argument. */
export type Context = Frame[] & Log & Result & Options & Record<State, Category>;

/** Test stack frame. */
export type Frame = { t0: number, index: number, name: string };

/** Test category. */
export type State = 'pass'|'fail'|'todo'|'idea'|'warn'|'skip'|'note';

/** Test filters. */
export type Filters = { only?: string[], except?: string[] };

/** Test options. */
export type Options = { args?: string[] } & Filters;

/** Collects test results. */
export type Category = Fn<[Step], Result> & {
  icon: string, label: string, color: Fn<[string], string>, results: Result[]
};

/** Result of test step. */
export type Result = {
  tD: number,
  state: State,
  substeps?: Result[],
  returned?: unknown,
  threw?: { todo?: boolean }
};

/** Test entrypoint. When a test module is run standalone,
  * tests contained in a `testSuite` run automatically.
  *
  * Use helpers like [the] and [forbid] to define test steps.
  *
  * Example:
  *
  *     import { suite, the, todo, ok, equal } from '@hackbg/fadroma';
  *     export default suite(import.meta, 'my module',
  *       'strings are TODOs',
  *       testThe('empty tests are TODOs'),
  *       testThe('substeps do not throw',
  *         context => { ok(true, "unary assertion") },
  *         testThe('tests can nest', context => {
  *           equal(1, 1, "binary assertion")
  *         })));
  *
  **/
function testSuite (meta: Meta, name: string, ...steps: (Step|string)[]) {
  const suite = testThe(name, ...steps);
  const enter = isEntrypoint(meta, argv[1]);
  if (enter) setImmediate(()=>testAndExit(suite, ...argv.slice(2)));
  return suite as Step;
};

/** Create empty test context. */
function testContext <T extends Context> (...options: Partial<T>[]): T {
  const context: T = [] as T;
  const config = merge({}, ...options as [object]) as T;
  const args = config?.args || [];
  return merge(context, logger(), {
    args,
    only:   args.filter(x=>(!x.startsWith('--'))&&(x[2]!=='!')),
    except: args.filter(x=>x.startsWith('--!')),
    //failFast: args.includes('--fail-fast'),
    //failTodo: args.includes('--fail-todo'),
    pass: testCategory('pass', `🟢`, ANSI.green,  'passed'  ),
    fail: testCategory('fail', `🔴`, ANSI.red,    'failed'  ),
    todo: testCategory('todo', `🟠`, ANSI.orange, 'tasks'   ),
    warn: testCategory('warn', `🟡`, ANSI.yellow, 'warnings'),
    skip: testCategory('skip', `🟣`, ANSI.purple, 'skipped' ),
    idea: testCategory('idea', `🔵`, ANSI.blue,   'ideas'   ),
    note: testCategory('note', `⚫️`, ANSI.dim,    'notes'   ),
  } as Partial<T>, config);

  function testCategory (
    state: State, icon: string, color: Fn<[string], string>, label: string = state
  ): Category {
    const props = { state, icon, label, color, results: [], get count () { return props.results.length } };
    const info = () => `[Category: ${icon} ${color(state)} (${props.results.length})]`;
    return toString(info)(reflect(state, function categorize (result: Partial<Result>): Result {
      result = { ...result, state };
      props.results.push(result);
      //if ('threw' in result && !!result.threw && !result.threw?.todo) context.error(result.threw);
      return result as Result;
    }, props));
  }
}

/** Run a single test step and exit the interpreter. */
async function testAndExit (test: Step, ...args: string[]) {
  const { context, result } = await testRun(test, args);
  stdout.write('\n' + lines(testReport({ context })) + '\n');
  exit(0); //exit(('pass' in result) ? 0 : 1); // FIXME result propagation
}

/** Run a test suite, collecting the results into a test report. */
async function testRun <T extends Context> (
  test: Step<T>, args: string[], context = testContext({ args }),
): Promise<{ context: Context, result: Result }> {
  if (typeof test !== 'function') test = todo(test);
  return { context, result: await withInfiniteStack(test, undefined, context) };
}

const categories = ['pass', 'fail', 'todo', 'idea', 'warn', 'skip', 'note']
/** Print a summary of test results. */
function testReport ({ context, details = [], indent = '', root = true }) {
  let line = '';
  for (const name of categories) {
    const category = context[name];
    const { icon, color, label } = category;
    line = line + spaced(` ${icon}`, color(`${context[name].count} ${label}`), '');
  }
  for (const result of context.fail.results) {
    context.error(result);
  }
  details.push(line);
  return details
}

/** A test case, consisting of a name and zero or more test steps.
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
  *     import { testSuite, the, ok, equal } from '@hackbg/fadroma';
  *     export const test1 = the('Thing', _ => ok(1 == 1));
  *     export const test2 = the('Things',
  *       _ => ok(1 === 1),               // unnamed substep
  *       the('Other', _ => equal(1, 1)), // named substep
  *       the('Third thing', test1)       // renamed substep
  *     );
  *     export default testSuite(import.meta, 'Test suite', test2);
  *
  **/
function testThe <T extends Context> (
  name: string|null, ...steps: (Step<T>|string)[]
): Step<T, void> {
  if (steps.length === 0) return todo(name);
  const substeps: Step<T>[] = steps.map(toStep);
  return reflect(name, testStep, { steps });
  async function testStep (returned: unknown, context: T): Promise<void> {
    let state: State = null, threw: Error;
    if (substeps.length === 0)
      context.todo({ index: 1, name, t0: performance.now() });
    if (substeps.length === 1)
      await reflect(substeps[0].name, runStep)(substeps[0]);
    for (let index = 1; index <= substeps.length; index++) { 
      const step = substeps[index - 1];
      await reflect(substepName(name, step), runStep)(step, index);
    }
    async function runStep (step: Step<T>, index = 1) {
      const t0 = performance.now();
      context.push({ index, name: step.name, t0 });
      const label = [
        testIndex(context).padEnd(20),
        testNames(context).padEnd(40)
      ].join(' │ ');
      context.info('@ '+msec(t0), '⏳');
      try {
        returned = await step(returned, context);
        state ||= 'pass';
      } catch (error) {
        threw ||= addStepStack(step, error);
        if (!threw.todo) state = 'fail';
        if (state === 'fail') throw threw;
      } finally {
        const t1 = performance.now();
        const tD = t1 - t0;
        state ||= 'todo';
        const { icon, color } = context[state];
        context.log(color('@ '+msec(t1)), ANSI.gray(4, '+'+msec(tD)), icon, color(label));
        context[state]({ index, name: step.name, t0, t1, tD, returned, threw });
        context.pop();
      }
    }
  }
}
const toStep = <T extends Context>(step: Step<T>|string) => (typeof step === 'string') ? todo(step) : step;
const testIndex = (stack: Frame[]) => stack.map(s=>s.index).join('.')+'.';
const testNames = (stack: Frame[]) => stack.map(s=>s.name).join(': ');
const substepName = (name, step) => [name, step.name].filter(Boolean).join(': ') || ANSI.gray(7, '(unnamed)');

/** Compare the value returned by the previous step with a JavaScript type;
  * and, optionally, a type-specific predicate. */
function testCompare <T extends Context> (type: null|undefined): Step<T, unknown>;
function testCompare <T extends Context> (type: 'string',   expected?: string): Step<T, unknown>;
function testCompare <T extends Context> (type: 'number',   expected?: number): Step<T, unknown>;
function testCompare <T extends Context> (type: 'bigint',   expected?: bigint): Step<T, unknown>;
function testCompare <T extends Context> (type: 'boolean',  expected?: string): Step<T, unknown>;
function testCompare <T extends Context> (type: 'symbol',   expected?: Symbol): Step<T, unknown>;
function testCompare <T extends Context> (type: 'function', expectedName?: string): Step<T, unknown>;
function testCompare <T extends Context> (type: 'object',   expectedConstructorName?: string): Step<T, unknown>;
function testCompare <T extends Context> (type: 'object',   expectedPrototype?: { [Symbol.hasInstance] (_) }): Step<T, unknown>;
function testCompare <T extends Context> (type: string, ...args: unknown[]): Step<T, unknown> {
  const name = `MUST be ${type}`;
  // call the returned function to assert
  return toString(`[${name}]`)(reflect(name, function mustBe (value: unknown) {
    // type check
    ok(typeof value === type, `not ${type}: ${inspect(value)}`);
    // value check
    if (args.length >= 1) {
      // 1st arg after type is type-specific predicate
      const [arg] = args;
      if (type === 'object') {
        // object prototype check
        if (typeof arg === 'string') {
          // by constructor name as string:
          equal(arg, Object.getPrototypeOf(value).constructor.name);
        } else if (
          typeof arg === 'object' &&
          typeof arg[Symbol.hasInstance] === 'function'
        ) {
          // using the `instanceof` operator:
          ok(value instanceof arg);
        } else {
          throw new Error('unsupported object predicate');
        }
      } else if (type === 'function') {
        // function name check
        if (typeof arg === 'string') {
          equal(arg, value.name);
        } else {
          throw new Error('unsupported function predicate');
        }
      } else if (type === 'string' || type === 'number' || type === 'bigint' || type === 'symbol') {
        equal(arg, value);
      } else {
        throw new Error(`unsupported type predicate: ${type} ${arg}`);
      }
    }
    return value;
  }));
}

function testEquals <T extends Context, V> (value: V, info?: string|Error): Step<T, unknown> {
  return reflect(`MUST equal ${inspect(value)}`, function mustEqual (last: unknown) {
    equal(value, last, info);
    return last;
  }, { value, info });
}

function testHas <T extends Context, X> (key: keyof X, ...args: Parameters<typeof testCompare>):
  Step<T, unknown>;
function testHas <T extends Context, X> (props: Partial<X>):
  Step<T, unknown>;
function testHas <T extends Context, X> (...args: unknown[]):
  Step<T, unknown>
{
  const arg0Type = typeof args[0];
  if (['string','number','symbol'].includes(arg0Type)) {
    // check for one key
    const key = args[0] as keyof X;
    const checks = args.slice(1);
    const name = `MUST have "${key}"`
    return toString(`[${name}]`)(reflect(name, async function testHasProperty (object: X, context: T) {
      ok(key in object, `${key} missing in ${inspect(object)}`);
      for (const check of checks) {
        if (typeof check !== 'function') {
          context.warn('not a function:', check);
          continue
        }
        await check(object[key as keyof typeof object], context);
      }
      return object;
    }));
  } else if (args[0] && typeof args[0] === 'object') {
    // partial equal
    const name = `MUST match "${inspect(args[0])}"`;
    return toString(`[${name}]`)(reflect(name, function testHasProperties (object: object) {
      for (const [k, expected] of Object.entries(args[0])) equal(object[k], expected, `not equal: k`);
      return object;
    }));
  } else {
    throw new Error('testHas: invalid argument', { args });
  }
}

function testIncludes <T extends Context, X> (item: X) {
  return reflect(`MUST include ${inspect(item)}`,
    function mustInclude (object: { includes (_: X): boolean }, _: T) {
      ok(object && typeof object === 'object', 'non-object');
      ok(typeof object['includes'] === 'function', 'no includes method');
      ok(object.includes(item), `doesn't include ${item}`)
      return object;
    }, { item })
}

/** FIXME: A test case which expects an exception to be threw. */
function testForbid (
  name: string, failure: Step, ...steps: Array<(_: Error)=>unknown>
) {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return reflect(name, forbidRun, { failure, steps });
  function forbidRun (context: Context) {
    throw Error.TODO('forbid')
    async function forbidRunTracked () {
      let result: unknown;
      let error:  unknown;
      try {
        result = await failure(context);
        error = new Error(`${name}: missing expected failure, got: ${result}`);
      } catch (e) {
        return e;
      }
      throw Object.assign(error, { name, result });
    }
  }
}
