import type { Fn, Step, Log, Timed, Reflects, Async, Prototype } from './index.ts';
import { ok, equal, throws, rejects, stdout, exit, argv, setImmediate, inspect } from './deps.ts';
import { isEntrypoint } from './client/cmd.ts';
import { logger } from './logger.ts';
import { ANSI, Error, alignTrace, addStepStack, dT, joined, spaced, lines, msec } from './format.ts';
import { call, reflect, identity, todo } from './call.ts';
export { call, ok, equal, throws, rejects, todo }

/** Context passed to each test step. */
export type Testing =
  & Log
  & TestResult
  & Record<TestCategoryName, TestCategory>
  & { /** Whether the whole test run should terminate as soon as one step fails. */
      failFast?: boolean
      /** Whether TODOs count toward test fails. */  
      failTodo?: boolean
      /** Filters. */
      include?:  string[]
      /** Filters. */
      exclude?:  string[] };

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

/** The result of a test step. */
export type TestResult = Timed & {
  /** Breadcrumb of indexes pointing to current step. */
  ids:       number[],
  /** Breadcrumb of names pointing to current step. */
  names:     string[],
  /** Bin into which this result goes. */
  state:     TestCategoryName,
  /** Result of last test step. */
  returned?: unknown
  /** Result of last test step. */
  thrown?:   unknown
  /** Results of substeps. */
  results?:  unknown[],
};

/** Assertions that go with MUST or SHOULD. */
export type RFC2119 = {
  be: <T extends Testing & { returned: unknown }>
    (type: string) => (context: T) => Async<T["returned"]>;
  beInstanceOf: <T extends Testing & { returned: Prototype }>
    (prototype: Prototype) => (context: T) => Async<T["returned"]>;
  equal: <T extends Testing & { returned: V }, V>
    (value: V) => (context: T) => Async<T["returned"]>;
  include: <T extends Testing & { returned: { includes (_: V): boolean } }, V>
    (value: V) => (_: T) => Async<T["returned"]>;
  have: <T extends Testing & { returned: O },
         O extends object,
         K extends keyof O,
         V extends O[K]>
    (key: K|unknown, value?: V|unknown) => (_: T) => Async<T["returned"]>;
};

/** Test result categories. TODO infer */
export type TestCategoryName =
  'pass'|'fail'|'todo'|'idea'|'warn'|'skip'|'note';

/** Callable. Collection of results for a given category. */
export type TestCategory = {
  /** Plain emoji. (Watch out for the unicode character widths.) */
  icon: string,
  /** Plural. What kind of items are there in the category? */
  label: string,
  /** Apply formatting modifiers to label. */
  color: Fn<[string], string>
  /** Test results in this category. */
  results: TestResult[]
} & (<R>(context: Testing,
         result?: R,
         ...details: unknown[]) => R);

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
  meta: ImportMeta, name: string, ...steps: (TestStep|string)[]
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
    const details = testSummary({ context, result });
    stdout.write('\n'+lines(details) + '\n');
    for (const name of [
      'pass', 'fail', 'todo', 'idea', 'warn', 'skip', 'note'
    ]) {
      const category = context[name];
      //console.log({category});
      const { icon, color, label } = category;
      const final = spaced(` ${icon}`, color(`${context[name].count} ${label}`), '')
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
  category = (state: string, icon: string, color: Step<string>, label = state, count = 0): TestCategory =>
    reflect(state, async function categorizeTestResult ({
      log, error, ids, names, name, tD,
      returned = undefined,
      results  = undefined,
      thrown   = undefined,
      details  = undefined,
    }) {
      count++;
      log(`+`+msec(tD),
          icon,
          color(ids.join('.').padEnd(20)),
          color(names.join(': ')));
      if (thrown && !thrown.todo) error(thrown);
      return { state, name, tD, thrown, returned, results, details };
    }, { state, icon, label, color, get count () { return count } }),
  pass = category('pass', `🟢`, ANSI.green,  'passed'  ),
  fail = category('fail', `🔴`, ANSI.red,    'failed'  ),
  todo = category('todo', `🟠`, ANSI.orange, 'tasks'   ),
  warn = category('warn', `🟡`, ANSI.yellow, 'warnings'),
  skip = category('skip', `🟣`, ANSI.purple, 'skipped' ),
  idea = category('idea', `🔵`, ANSI.blue,   'ideas'   ),
  note = category('note', `⚫️`, ANSI.dim,    'notes'   ),
  ...rest
}: Partial<T> & {
  args?: string[],
  category?: (
    state:  TestCategoryName,
    icon:   string,
    color:  Step<string>,
    label?: string
  ) => TestCategory;
} = {}): T => ({
  ...logger(),
  failFast, failTodo, include, exclude, t0, ids, names,
  pass, fail, todo, warn, skip, idea, note,
  ...rest,
});

/** Print a summary of test results. */
export function testSummary ({ context, result, details = [], indent = '' }) {
  if (!context[result.state]) return [];
  const state = result.state;
  const name  = result.name;
  const icon  = context[state]?.icon  || '';
  const color = context[state]?.color || identity;
  const style = (result.results?.length > 1) ? ANSI.bold : identity;
  const line  = spaced(` ${icon}`, color(state), color((indent+' ').padEnd(15,'-')), style((name||'<unnamed>').padEnd(20)));
  if (state === 'fail' && result?.error?.message) {
    details.push(spaced(line, ANSI.gray(2, joined(': ', ANSI.bold(result.error.name), result.error.message))));
    details.push(result.error.stack.split('\n').map(alignTrace).slice(1).join('\n'));
  } else {
    details.push(line);
  };
  const results = result?.results || [];
  if (results.length === 1 && results[0].state === 'pass' && !results[0].name) {
    return details
  }
  for (let index = 0; index < results.length; index++) {
    testSummary({
      context,
      details,
      result: results[index],
      indent: joined('.', indent, Number(index)+1),
    });
  }
  return details
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
    return todo(name);
  } else {
    return reflect(name, expectations, { steps });
  }
  async function expectations (context: T): Promise<TestResult> {
    const t1 = performance.now();
    // Store original context values
    const {t0, ids = [], names = []} = context;
    // Run each step in updated context
    context.results = [];
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      if (steps.length > 1) {
        context.t0    = performance.now();
        context.ids   = [...ids, index+1].filter(Boolean);
        context.names = [...names, step.name].filter(Boolean);
      }
      if (step.steps?.length > 1) context.log(
        `@`+msec(context.t0), '🏁',
        context.ids.join('.').padEnd(20),
        context.names.join(': '));
      try {
        context.returned = await step(context) as TestResult;
        context.thrown = undefined;
      } catch (error) {
        context.returned = undefined;
        context.thrown = addStepStack(step, error);
        if (error.todo) {
          context.results.push(context.todo({ ...context, name: step.name, tD: dT(t0) }));
          if (context.failTodo) throw error;
          continue;
        } else {
          const failure = context.fail({
            ...context, name: step.name, tD: dT(t0),
            log: steps.length > 1 ? context.log : identity
          });
          context.results.push(failure);
          if (context.failFast) {
            throw error;
          } else {
            return failure as TestResult;
          }
        }
      }
      context.results.push(context.pass({
        ...context, name: step.name, tD: dT(t0),
        log: steps.length > 1 ? context.log : identity
      }));
    }
    // Restore original context values and add results.
    Object.assign(context, { t0, ids, names })
    let state = 'pass';
    if (context.results.some(isTodo)) state = context.failTodo ? 'fail' : 'todo';
    if (context.results.some(isFail)) state = 'fail';
    return context[state]({
      ...context, name, tD: dT(t1),
      log: steps.length > 1 ? context.log : identity
    });
  }
}
const isTodo = (x?: { state?: unknown }) => x?.state === 'todo';
const isFail = (x?: { state?: unknown }) => x?.state === 'fail';

/** Assertions. */
export const must: RFC2119 = {
  be: (type) => reflect(`MUST be ${type}`, function mustBe ({ returned }) {
    ok(typeof returned === type, `not ${type}: ${inspect(returned)}`);
    return returned;
  }, { type }),

  equal: (expected, info?: string|Error) => reflect(
    `MUST equal ${inspect(expected)}`, function mustEqual ({ returned }) {
      equal(expected, returned, info);
      return returned;
    }, { expected }),

  beInstanceOf: (prototype) => reflect(`MUST be instance of ${prototype}`,
    function mustBe ({ returned }) {
      ok(returned, 'missing');
      ok(typeof returned === 'object', `not object: ${inspect(returned)}`);
      ok(returned instanceof prototype);
      return returned;
    }, { prototype }),

  have: (key, ...args) => reflect(
    `MUST have ${key}` + ((args.length > 0) ? ` = ${inspect(args[0])}` : ''),
    function mustHave ({ returned }) {
      ok(returned, 'falsy');
      ok(key as keyof typeof returned in returned, `${key} missing`);
      if (args.length > 0) {
        const expected = args[0];
        const actual   = returned[key as keyof typeof returned];
        const message  = `${inspect(actual)} != ${inspect(expected)}`;
        equal(expected, actual, `${key} wrong: ${message}`);
      }
      return returned;
    }, { key, value: args[0], checks: args.slice(1) }),

  include: (item) => reflect(
    `MUST include ${inspect(item)}`,
    function mustInclude ({ returned }) {
      ok(returned && typeof returned === 'object', 'non-object');
      ok(typeof returned['includes'] === 'function', 'no includes method');
      ok(returned.includes(item), `doesn't include ${item}`)
      return returned;
    }, { item }),

};

/** Continue as substep. */
export const ditto = () => {
  let name = 'ditto';
  return Object.defineProperty(ditto, 'name', { get () { return name } });
  function ditto ({ returned }) {
    name = returned?.name;
    return returned();
  }
};

/** TODO: RFC2119 assertions that only emit warning. */
export const should = { /* TODO */ };

/** TODO: Run steps in parallel. */
export const parallel = (name: string, variants: ((_: Testing)=>unknown)[]) =>
  expect(name, async (context: Testing) => {
    await Promise.all(variants.map(variant=>variant(context)))
  });

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
  .map(([k, _v])=>expect(k, ...steps))), variants, steps);

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
