import type { Fn, Log, Reflects, Async, Prototype, Meta } from './index.ts';
import { ok, equal, throws, rejects, stdout, exit, argv, setImmediate, inspect } from './deps.ts';
import { isEntrypoint } from './command.ts';
import { logger } from './logger.ts';
import { ANSI, dT, joined, spaced, lines, msec } from './format.ts';
import { Error, addStepStack, withInfiniteStack, alignTrace } from './error.ts';
import { merge, call, reflect, identity, todo } from './call.ts';

export {
  testContext as context,
  testRun     as run,
  testThe     as the,
  testSuite   as suite,
  testReport  as report,
  forbid, ditto, matrix, call, ok, equal, throws, rejects, todo
};

/** Test step. */
export type Step <C extends Context = Context, A = unknown, B = A> =
  Reflects & ((_: A, __?: C) => Async<B>) & { skip?: boolean };

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

/** Test context passed to eacgh step. */
export type Context = Log & Result & Options & Record<State, Category> & {
  args?: string[], stack: Frame[]
};

/** Create empty test context. */
function testContext <T extends Context> (...options: Partial<T>[]): T {
  const context: T = {} as T;
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
    stack: [],
  } as Partial<T>, config);

  function testCategory (
    state: State, icon: string, color: Fn<[string], string>, label: string = state
  ): Category {
    let count = 0;
    const props = { state, icon, label, color, get count () { return count } };
    return reflect(state, function categorizeResult (result: Partial<Result>): Result {
      count++;
      result = { ...result, state };
      if ('threw' in result && !!result.threw && !result.threw?.todo) context.error(result.threw);
      return result as Result;
    }, props);
  }
}

/** Run a single test step and exit the interpreter. */
async function testAndExit (test: Step, ...args: string[]) {
  const { context, result } = await testRun(test, args);
  stdout.write('\n' + lines(testReport({ context, result })) + '\n');
  exit(0); //exit(('pass' in result) ? 0 : 1); // FIXME result propagation
}

/** Run a test suite, collecting the results into a test report. */
async function testRun <T extends Context> (
  test: Step<T>, args: string[], context = testContext({ args }),
): Promise<{ context: Context, result: Result }> {
  if (typeof test !== 'function') test = todo(test);
  return { context, result: await withInfiniteStack(test, undefined, context) };
}

/** Print a summary of test results. */
function testReport ({
  context, result, details = [], indent = '', root = true,
}) {
  if (!context[result?.state]) return [];
  const state = result?.state;
  const name  = result?.name;
  const icon  = context[state]?.icon  || '';
  const color = context[state]?.color || identity;
  const style = (result.results?.length > 1) ? ANSI.bold : identity;
  if (state === 'fail' && result?.error?.message) {
    const line  = spaced(` ${icon}`, color(state), color((indent+' ').padEnd(15,'-')), style((name||'<unnamed>').padEnd(20)));
    details.push(spaced(line, ANSI.gray(2, joined(': ', ANSI.bold(result.error.name), result.error.message))));
    details.push(result.error.stack.split('\n').map(alignTrace).slice(1).join('\n'));
  };
  const results = result?.results || [];
  if (results.length === 1 && results[0].state === 'pass' && !results[0].name) {
    return details
  }
  for (let index = 0; index < results.length; index++)
    testReport({ context, result: results[index], details,
      indent: joined('.', indent, Number(index)+1), root: false, });
  if (root) {
    let line = '';
    for (const name of [
      'pass', 'fail', 'todo', 'idea', 'warn', 'skip', 'note'
    ]) {
      const category = context[name];
      const { icon, color, label } = category;
      line = line + spaced(` ${icon}`, color(`${context[name].count} ${label}`), '');
    }
    details.push(line);
  }
  return details
}

export type Frame = { t0: number, index: number, name: string };

export type State = 'pass'|'fail'|'todo'|'idea'|'warn'|'skip'|'note';

export type Filters = { only?: string[], except?: string[] };

export type Options = { args?: string[] } & Filters;

/** Collects test results. */
export type Category = Fn<[Step], Result> & {
  icon: string, label: string, color: Fn<[string], string>, results: Result[]
};

/** The result of a test step. */
export type Result = {
  tD: number, state: State, substeps?: Result[],
  returned?: unknown, threw?: { todo?: boolean }
};

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
  async function testStep (returned: unknown, context: T) {
    let state: State = null, threw: Error;
    if (substeps.length === 0)
      return context.todo({ index: 1, name, t0: performance.now() });
    if (substeps.length === 1)
      return await reflect(substeps[0].name, runStep)(substeps[0]);
    for (let index = 1; index <= substeps.length; index++)
      await reflect([name, substeps[index-1].name].filter(Boolean).join(': '), runStep)(substeps[index-1], index);
    async function runStep (step: Step<T>, index = 1) {
      const t0 = performance.now();
      const stepName = [name, step.name].filter(Boolean).join(': ') || ANSI.gray(7, '(unnamed)');
      context.stack.push({ index, name: stepName, t0 });
      context.info('@'+msec(t0), '⏳', index, stepName);
      try {
        returned = await step(returned, context);
        state ||= 'pass';
      } catch (error) {
        threw ||= addStepStack(step, error);
        if (!threw.todo) state = 'fail';
        if (state === 'fail') throw threw;
      } finally {
        const tD = performance.now() - t0;
        state ||= 'todo';
        const { icon, color } = context[state];
        context.log('+'+msec(tD), icon, color(stepName));
        context[state]({ index, name: stepName, t0, tD, returned, threw });
        context.stack.pop();
      }
    }
  }
}
const toStep = <T extends Context>(step: Step<T>|string) =>
  (typeof step === 'string') ? todo(step) : step;
const testIndex = (stack: Frame[]) => stack.map(s=>s.index).join('.')+'.';
const testNames = (stack: Frame[]) => stack.map(s=>s.name).join(': ');

export function is <T extends Context> (type: 'function', name?: string): Step<T, unknown>;
export function is <T extends Context> (type: 'object', name?: string): Step<T, unknown>;
export function is <T extends Context> (type: 'object', prototype?: Fn): Step<T, unknown>;
export function is <T extends Context> (type: string, ..._args: unknown[]): Step<T, unknown> {
  return reflect(`must be ${type}`, function mustBe (last: unknown) {
    ok(typeof last === type, `not ${type}: ${inspect(last)}`);
    return last;
  }, { type });
}

export function isInstanceOf <T extends Context> (
  prototype: { [Symbol.hasInstance] (_) }
): Step<T, unknown> {
  return reflect(`MUST be instance of ${prototype}`, function mustBe ({ returned }) {
    ok(returned, 'missing');
    ok(typeof returned === 'object', `not object: ${inspect(returned)}`);
    ok(returned instanceof prototype);
    return returned;
  }, { prototype })
}

export function equals <T extends Context, V> (
  value: V, info?: string|Error
): Step<T, unknown> {
  return reflect(`must equal ${inspect(value)}`, function mustEqual (last: unknown) {
    equal(value, last, info);
    return last;
  }, { value, info });
}

export function has <T extends Context> (
  key, ...args
): Step<T, unknown> {
  const info = (typeof key === 'string')
    ? `must have "${key}"` + ((args.length > 0) ? ` = ${inspect(args[0])}` : '')
    : `must partially equal "${inspect(key)}"`;
  return reflect(info, function mustHave (last: object) {
    ok(last, 'falsy');
    if (typeof key === 'string') {
      ok(key as keyof typeof last in last, `${key} missing in ${inspect(last)}`);
      if (args.length > 0) {
        const expected = args[0];
        const actual   = last[key as keyof typeof last];
        const message  = `${inspect(actual)} != ${inspect(expected)}`;
        equal(expected, actual, `${key} wrong: ${message}`);
      }
    } else if (typeof key === 'object') {
      for (const [k, expected] of Object.entries(key)) {
        equal(last[k], expected, `not equal: k`);
      }
    } else {
      throw new Error('mustHave: invalid argument')
    }
    return last;
  }, { key, value: args[0], checks: args.slice(1) })
}

export function includes (item) {
  return reflect(`MUST include ${inspect(item)}`,
    function mustInclude ({ returned }) {
      ok(returned && typeof returned === 'object', 'non-object');
      ok(typeof returned['includes'] === 'function', 'no includes method');
      ok(returned.includes(item), `doesn't include ${item}`)
      return returned;
    }, { item })
}

/** Assertions. */
export const MUST = {
  be: is, equal: equals, beInstanceOf: isInstanceOf, have: has, include: includes,
};

/** TODO: Assertions that only warn. */
export const SHOULD = {
  /* TODO */
};

/** Call function returned by last test step. */
const ditto = () => {
  let name = 'ditto';
  return Object.defineProperty(ditto, 'name', { get () { return name } });
  function ditto (returned) {
    name = returned?.name;
    return returned();
  }
};

/** TODO: Run steps in parallel. */
function parallel (name: string, variants: ((_: Context)=>unknown)[]) {
  return testThe(name, async (context: Context) => {
    await Promise.all(variants.map(variant=>variant(context)))
  });
}

/** FIXME: Run the same set of test steps against different starting points.
  *
  * Example:
  *
  *     const strawberry = 1.0, chocolate = 1.0, vanilla = 1.0;
  *     const flavors = { strawberry, chocolate, vanilla };
  *     const testTastiness = matrix('Ice cream', flavors, flavor => [
  *       MUST.gte(0.5, 'bleh')
  *     ])
  *
  * */
function matrix <T> (
  name: string, variants: T[]|Record<string, T>, ...steps: Step[]
) {
  return Object.assign(testThe(name, ...Object.entries(variants)
    .map(([k, _v])=>testThe(k, ...steps))), variants, steps);
}

/** FIXME: A test case which expects an exception to be threw. */
function forbid (
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
