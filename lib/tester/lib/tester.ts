/** Use this to prepare a function with arguments for testing.
  *
  * See:
  *   - https://en.wikipedia.org/wiki/Currying
  *   - https://en.wikipedia.org/wiki/Partial_application
  * 
  * Example:
  *
  *     // A function with 2 arguments:
  *     const result = await fn(arg1, arg2)
  *     ok(result > 0)
  *
  *     // Is tested like this:
  *     expect("description", call(fn, arg1, arg2), result => {
  *       ok(result > 0)
  *     })
  */
export const call = (fn, ...args) => Object.assign(fn.bind(null, ...args), {
  fn, args, stack: new Error().stack?.split('\n').slice(3)
})

/** Use this to stub a test. */
export const todo = (...info) => Object.assign(function todo ({ report = TestReport() }) {
  report.todo++
}, { info })

/** A **test suite** consists of a name and one or more **test case**s.
  * 
  * - The test suite acts as a checklist, and logs the
  *   outcome of each test case. 
  * - Test cases are functions.
  *   Using `test`, `testAx`, `testTx` can help you prepare them.
  * - The return value of each test case is NOT passed to the next one.
  * - The return value of each test case is preserved,
  *   and an array of return values is returned at the end. */
export const suite = (name, ...tests) =>
  renamed(name, async function suiteRun ({
    report = new TestReport(), prefix = null, count = ''
  } = {}) {
    const label = [prefix, name].filter(Boolean).join(': ')
    return report.track(count, label, async function suiteRunTracked () {
      const results = tests.map(()=>{})
      for (const index in tests) {
        const order   = String(Number(index)+1)
        const counter = [count, order].filter(Boolean).join('.')
        const context = { report, count: counter, prefix: name }
        const result  = await tests[index](context)
        results.push(result)
      }
      return results
    })
  })

/** A **test case** consists of a name and one or more **test step**s.
  * 
  * - Test steps are functions. Using `call` can help you prepare them.
  * - Each function receives the awaited return value of the previous one.
  * - If no test step throws an uncaught exception, the test case is a pass. */
export const expect = (name, ...steps) =>
  renamed(name, async function expectRun ({
    report = new TestReport(), count = '', prefix = null,
  } = {}) {
    const label = [prefix, name].filter(Boolean).join(': ')
    return report.track(count, label, async function expectRunTracked () {
      let step, state
      try {
        for (step of steps) state = await step(state) ?? state
        return state
      } catch (e) {
        e.stack ||= ''
        if (step.stack) e.stack += '\n  Test defined at:\n' + step.stack.join('\n')
        throw e
      }
    })
  })

/** A **test case** for expecting an exception to be thrown. */
export const forbid = (name, fn, callback?) => {
  name = [`Forbid`, name].filter(Boolean).join(': ')
  return renamed(name, async function forbidRun ({
    report = new TestReport(), count = '', prefix = null,
  } = {}) {
    const label = [prefix, name].filter(Boolean).join(': ')
    return report.track(count, label, async function forbidRunTracked() {
      let result
      let error
      try {
        result = await fn()
        error = new Error(`${name}: missing expected rejection, got: ${result}`)
      } catch (e) {
        if (callback) e = await callback(e)
        return e
      }
      throw Object.assign(error, { name, result })
    })
  })
}

function renamed (value, fn) {
  Object.defineProperty(fn, 'name', { value })
  return fn
}

export const includes = (x) => line => line.includes(x)

export function assertLength (length, x, name) {
  equal(x?.length, length, name)
  return x
}
