import type { Fn, Step, Log, Timed, Takes, Returns, Reflects, Async } from './index.ts';
import { ok, equal, throws, rejects, getCwd, stdout, exit, argv, setImmediate, inspect } from './deps.ts';
import { isEntrypoint } from './client/cmd.ts';
import { logger } from './logger.ts';
import { ANSI, Error, alignTrace, addStepStack, msec, dT, joined } from './format.ts';
import { call, sequence, reflect, objectReducer, reduceObject, identity, todo } from './call.ts';
export { call, ok, equal, throws, rejects, todo }

/** Context passed to each test step. */
export type Testing = Log & Timed & {
  /** Whether the whole test run should terminate as soon as one step fails. */
  failFast?: boolean,
  /** Whether TODOs count toward test fails. */  
  failTodo?: boolean
  /** Filters. */
  include?:  string[],
  /** Filters. */
  exclude?:  string[],
  /** Breadcrumb of indexes pointing to current step. */
  ids:       number[],
  /** Breadcrumb of names pointing to current step. */
  names:     string[],
  /** Test results are collected here */
  report:    TestReport,
  /** Result of last test step. */
  returned:  unknown
};

/** A step of the test suite.
  *
  * Test steps are not meant to be piped to each other. 
  * Values returned by steps are collected in an array
  * and returned at the end.
  *
  * In order to pass state between steps, mutate the context,
  * optionally extending it with custom properties via the `T` generic.
* */
export type TestStep<T extends Testing = Testing> =
  Reflects & Fn<[T], Async<unknown>> & { skip?: boolean };

/** Assertions that go with MUST or SHOULD. */
export type RFC2119 = {
  be
    (type: string):
      (_: Testing & { returned: unknown })
        => Async<typeof _["returned"]>;
  beInstanceOf
    (prototype: { [Symbol.hasInstance] (_): boolean }):
      (_: Testing & { returned: { [Symbol.hasInstance] (_): boolean } } )
        => Async<typeof _["returned"]>;
  equal <V>
    (value: V):
      (_: Testing & { returned: V })
        => Async<typeof _["returned"]>;
  have <O extends object, K extends keyof O, V extends O[K]>
    (key: K|unknown, value?: V|unknown):
      <T extends Testing & { returned: O }>
        (_: T) => Async<typeof _["returned"]>;
  include <V>
    (value: V):
      (_: Testing & { returned: { includes (_: V): boolean } })
        => Async<typeof _["returned"]>;
};

/** The result of a test step. */
export type TestResult = Timed & {
  /** Name of test case. */
  name:      string,
  /** Bin into which this result goes. */
  state:     TestCategoryName,
  /** Result of last test step. */
  returned?: unknown
  /** Results of substeps. */
  results?:  unknown[],
  /** Thrown error, if any. */
  error?:    Error,
};

/** Lists of test results by category. */
export type TestReport = Record<TestCategoryName, TestCategory>;

/** Test result categories. TODO infer */
export type TestCategoryName =
  'pass'|'fail'|'todo'|'idea'|'warn'|'skip'|'note';

/** Callable. Collection of results for a given category. */
export type TestCategory = TestCollect & TestCategoryOpts & {
  /** Test results in this category. */
  results: TestResult[]
};

export type TestCategoryOpts = {
  /** Plain emoji. (Watch out for the unicode character widths.) */
  icon: string,
  /** Plural. What kind of items are there in the category? */
  label: string,
  /** Apply formatting modifiers to label. */
  color: Fn<[string], string>
};

/** Collect a test result into a category. */
export type TestCollect = <R>(
  context: Testing, result?: R, ...details: unknown[]
) => R;

/** Test entrypoint. When a test module is run standalone,
  * tests contained in a `testSuite` run automatically.
  *
  * Use helpers like [expect] and [forbid] to define test steps.
  *
  * Example:
  *
  *     import { testSuite, expect, todo, ok, equal } from '@hackbg/fadroma';
  *     export default testSuite(import.meta, 'My module',
  *       'Strings are TODOs',
  *       expect('Empty expects are TODOs'),
  *       expect('Does not throw',
  *         context => { ok(true, "unary assertion") },
  *         expect('Nested test', context => {
  *           equal(1, 1, "binary assertion")
  *         })));
  *
  **/
export function testSuite (
  meta: ImportMeta, name: string, ...steps: TestStep[]
) {
  const testSuite = expect(name, ...steps);
  if (isEntrypoint(meta, argv[1])) {
    setImmediate(()=>testAndExit(testSuite, ...argv.slice(2)))
  };
  return testSuite as TestStep;
}

/** Run a single test step and exit the interpreter. */
export const testAndExit = (test: TestStep, ...args: string[]) =>
  testRun(test, args).then(({ context, result })=>{
    const lines = testSummary({ context, result });
    stdout.write('\n'+joined('\n', lines) + '\n');
    for (const name of [
      'pass', 'fail', 'todo', 'idea', 'warn', 'skip', 'note'
    ]) {
      const category = context.report[name];
      //console.log({category});
      const { icon, color, label } = category;
      const final = joined(' ', ` ${icon}`,
        color(`${context.report[name].length} ${label}`), '')
      stdout.write('\n'+final);
    }
    exit(('pass' in result) ? 0 : 1);
  });

/** Run a test suite, collecting the results into a test report. */
export async function testRun <T extends Testing> (
  test: TestStep<T>,
  args: string[],
  context = testContext({ args }),
): Promise<{ context: Testing, result: TestResult }> {
  if (typeof test !== 'function') test = todo(test);
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  const result = await test(context) as TestResult;
  Error.stackTraceLimit = stackTraceLimit;
  return { context, result };
}

/** Create an empty test context. */
export const testContext = <T extends Testing> ({
  args     = [],
  failFast = args.includes('--fail-fast'),
  failTodo = args.includes('--fail-todo'),
  include  = args.filter(x=>(!x.startsWith('--'))&&(x[2]!=='!')),
  exclude  = args.filter(x=>x.startsWith('--!')),
  t0       = performance.now(),
  ids      = [],
  names    = [],
  report   = {
    pass: testCategory('pass', `🟢`, ANSI.green,  'passed'  ),
    fail: testCategory('fail', `🔴`, ANSI.red,    'failed'  ),
    todo: testCategory('todo', `🟠`, ANSI.orange, 'tasks'   ),
    warn: testCategory('warn', `🟡`, ANSI.yellow, 'warnings'),
    skip: testCategory('skip', `🟣`, ANSI.purple, 'skipped' ),
    idea: testCategory('idea', `🔵`, ANSI.blue,   'ideas'   ),
    note: testCategory('note', `⚫️`, ANSI.dim,    'notes'   ),
  } as const,
  ...rest
}: Partial<T> & { args?: string[] } = {}): T => ({
  ...logger(),
  failFast, failTodo, include, exclude, report, t0, ids, names,
  ...rest,
});

/** Create a callable test result collection. */
const testCategory = (
  id: string, icon: string, color: Step<string>, label = id
): TestCategory => reflect(id, async function categorizeTestResult (
  context: Testing, ...details: unknown[]
) {
  const { log, t0, ids, names } = context;
  const results = [];
  const t1 = performance.now();
  const tD = t1 - t0;
  const result = { tD, details };
  log(msec(tD), icon, color(id), ANSI.blue(ids.join('.')),
    ANSI.gray(names.length, names.join(': ')), ...details.filter(Boolean));
  results.push(result);
  return {
    state: id,
    name,
    td: dT(t0),
    error,
    returned,
    results
  };
}, { id, icon, label, color });

/** Print a summary of test results. */
export function testSummary ({ context, result, lines = [], indent = '' }) {
  if (!context.report[result.state]) return [];
  const state = result.state;
  const name  = result.name;
  const icon  = context.report[state]?.icon  || '';
  const color = context.report[state]?.color || identity;
  const style = (result.results?.length > 1) ? ANSI.bold : identity;
  const line  = joined(' ', ` ${icon}`, color(state), color((indent+' ').padEnd(15,'-')), style((name||'<unnamed>').padEnd(20)));
  if (state === 'fail' && result?.error?.message) {
    lines.push(joined(' ', line, ANSI.gray(2, joined(': ', ANSI.bold(result.error.name), result.error.message))));
    lines.push(result.error.stack.split('\n').map(alignTrace).slice(1).join('\n'));
  } else {
    lines.push(line);
  };
  const results = result?.results || [];
  if (results.length === 1 && results[0].state === 'pass' && !results[0].name) {
    return lines
  }
  for (let index = 0; index < results.length; index++) {
    testSummary({
      context,
      lines,
      result: results[index],
      indent: joined('.', indent, Number(index)+1),
    });
  }
  return lines
}

/** A test case, consisting of a name and zero or more test steps.
  *
  *   1. Steps run in sequence. If no step throws, the case passes.
  *   2. **Empty case** like `expect('empty')`
  *      amounts to `expect('empty', todo())`.
  *   3. **Stringy step** like `expect('empty', 'string')`
  *      amounts to `expect('empty', expect('string'))`
  *   4. **Falsy step** like `expect('something', null)` is only counted.
  *
  * Example:
  *
  *     import { testSuite, expect, ok, equal } from '@hackbg/fadroma';
  *     export const test1 = expect('Thing', _ => ok(1 == 1));
  *     export const test2 = expect('Some things',
  *       _ => ok(1 === 1),
  *       _ => equal(1, 1),
  *       test1);
  *     export default testSuite(import.meta, 'Test suite', test2);
  *
  **/
export function expect <T extends Testing> (
  name: string|null, ...stepsAndTodos: (TestStep<T>|string)[]
) {
  const steps: TestStep<T>[] = stepsAndTodos.map(
    step=>(typeof step === 'string')?todo(step):step);
  if (steps.length === 0) {
    return reflect(name, call(todo, name, undefined), { steps });
  } else if (steps.length === 1) {
    return reflect(name, expectation, { steps });
  } else {
    return reflect(name, expectations, { steps });
  }
  async function expectation (context: T): Promise<TestResult> {
    const step = steps[0];
    const t0 = performance.now();
    try {
      const returned = await step(context) as TestResult;
      return { state: 'pass', name: step.name, tD: dT(t0), returned };
    } catch (error) {
      return expectationFailed(t0, step, error, context);
    }
  }
  async function expectations (context: T): Promise<TestResult> {
    const t1 = performance.now();
    const {t0, ids = [], names = []} = context;
    let results: Array<unknown> = steps.map(_=>undefined);
    const inContext = (step: TestStep<T>, index: number) => async (_: T) => {
      context.t0    = performance.now();
      context.ids   = [...ids, Number(index)+1].filter(Boolean);
      context.names = [...names, step.name].filter(Boolean);
      try {
        context.returned = await step(context);
      } catch (error) {
        context.returned = expectationFailed(t0, step, error, context);
      }
      results[index] = context.returned;
    }
    await sequence(...steps.map(inContext))(context);
    Object.assign(context, { t0, ids, names, results })
    results = results.filter(Boolean);
    let state: TestCategoryName = 'pass';
    if (results.some(isTodo)) state = context.failTodo ? 'fail' : 'todo';
    if (results.some(isFail)) state = 'fail';
    return { state, name, tD: dT(t1), results };
  }
  function expectationFailed (t0: number, step: TestStep<T>, error: Error, context: T) {
    const e = addStepStack(step, error);
    if (e.todo) {
      if (context.failTodo && context.failFast) throw e;
      return { state: 'todo', name: step.name, tD: dT(t0), error: e };
    } else {
      if (context.failFast) throw e;
      return { state: 'fail', name: step.name, tD: dT(t0), error: e };
    }
  }
}
const isTodo = (x?: { state?: unknown }) => x?.state === 'todo';
const isFail = (x?: { state?: unknown }) => x?.state === 'fail';

//const stepSummary = ({ t0, ids, names }) => joined('', stepIds(ids), stepNames(names));
//const stepIds     = ids   => blue(((joined('.', ...ids)||'<no id>')+' ').padEnd(10));
//const stepNames   = names => joined('│', names) || '<no name>';//.map((x, i)=>gray(i*2, x)));

/** FIXME: A test case which expects an exception to be thrown. */
export function forbid (
  name: string, failure: TestStep, ...steps: Array<(_: Error)=>unknown>
) {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return reflect(name, forbidRun, { failure, steps });
  function forbidRun (context: Testing) {
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

/** Assertions. */
export const must: RFC2119 = {
  be: (type) => reflect(
    `MUST be ${type}`,
      function mustBe ({ returned }) {
        ok(typeof returned === type);
        return returned;
      }),
  beInstanceOf: (prototype) => reflect(
    `MUST be instance of ${prototype}`,
      function mustBe ({ returned }) {
        ok(returned && typeof returned === 'object', 'non-object');
        ok(returned instanceof prototype);
        return returned;
      }),
  equal: (value, info?: string|Error) => reflect(
    `MUST equal ${inspect(value)}`,
      function mustEqual ({ returned }) {
        equal(value, returned, info);
        return returned;
      }),
  have: (key, ...args) => reflect(
    `MUST have ${key}` + ((args.length > 0) ? ` = ${inspect(args[0])}` : ''),
      function mustHave ({ returned }) {
        ok(returned && typeof returned === 'object', 'non-object');
        ok(key as keyof typeof returned in returned, `${key} missing`);
        if (args.length > 0) {
          const expected = args[0];
          const actual   = returned[key as keyof typeof returned];
          const message  = `${key} wrong (${inspect(actual)} != ${inspect(expected)})`;
          equal(actual, expected, message);
        }
        return returned;
      }, { key, value: args[0], checks: args.slice(1) }),
  include: (value) => reflect(
    `MUST include ${inspect(value)}`,
    function mustInclude ({ returned }) {
      ok(returned && typeof returned === 'object', 'non-object');
      ok(typeof returned['includes'] === 'function', 'no includes method');
      ok(returned.includes(value), `doesn't include ${value}`)
      return returned;
    }),
};

/** Assertions that only emit warning. */
export const should = { /* TODO */ };

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
export const matrix = <T>(
  name: string, variants: T[]|Record<string, T>, ...steps: TestStep[]
) => Object.assign(expect(name, ...Object.entries(variants)
  .map(([k, v])=>expect(k, ...steps))), variants, steps);
/** TODO: Run steps in parallel. */
export const parallel = (name: string, variants: ((_: Testing)=>unknown)[]) =>
  expect(name, async (context = testContext()) => {
    await Promise.all(variants.map(variant=>variant(context)))
  });
