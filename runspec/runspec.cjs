const assert = require('assert')
const { inspect } = require('util')

Error.stackTraceLimit = 100

const LABELS = {
  OK:   'OK   💚 ',
  FAIL: 'FAIL 💔 ',
  TODO: 'TODO 👉 ',
}

module.exports         = runSpec
module.exports.default = runSpec
module.exports.runSpec = runSpec

const TODO = module.exports.TODO = Symbol('TODO')

/** Run test specifications defined as nested objects. */
async function runSpec (suites, selected = process.argv.slice(2)) {

  /** Count test results. */
  let passed = 0
  let failed = 0
  let undone = 0

  /** Iterate over each test suite */
  for (const [suite, spec] of Object.entries(suites||{})) {

    /** If there are specific test suites selected and this is not one of them, skip it. */
    if (selected.length > 0 && !selected.includes(suite)) {
      continue
    }

    /** Count length of test names to align the final output. */
    let longestName = 0

    /** Collection of tests in the suite. */
    const tests   = {}

    /** Collection of results of each test. */
    const results = {}

    /** Iterate over each test case in the suite. */
    for (const [name, fn] of Object.entries(spec)) {

      /** Output alignment, see above. */
      if (name.length > longestName) longestName = name.length

      /** Wrap the test case in a function that captures its result. */
      tests[name] = async () => {
        try {
          /** Run the test case, passing the assertion library. */
          const result = fn(assert)
          /** Convert all test cases to async. */
          return await Promise.resolve(result)
            /** On success, record the success and any output data. */
            .then(data=>results[name] = [true, JSON.stringify(data)])
        } catch (error) {
          /** On failure, record the failure and the error message. */
          results[name] = [false, error]
        }
      }

    }

    /** Run all the collected test cases. */
    await Promise.all(Object.values(tests).map(run=>run()))

    /** Prepare the output of this test suite. */
    let output = `\n${suite}\n`

    /** Iterate over every test result collected by the wrapper function.
      * Iterating over tests instead of results makes the output order static,
      * because `tests` is populated synchronously and `results` is asynchronous.
      * TODO use Map instead of Object for strong insertion order guarantee? */
    for (let name of Object.keys(tests)) {
      let [success, data] = results[name]
      /** Align output by padding each name to the maximum length. */
      name = name.padEnd(longestName)
      if (success) {
        /** If the test passed, report success and optionally print output data. */
        if (data === undefined) data = ''
        output += `${LABELS.OK}  ${name}  ${data}\n`
        passed++
      } else {
        /** If the test was marked as TODO by throwing the TODO symbol
          * that is exported by this library, don't count it as failed. */
        if (data === TODO) {
          output += `${LABELS.TODO}  ${name}\n`
          undone++
          continue
        }
        /** If the test threw anything else, count it as failed
          * and report details about what failed. */
        if (data instanceof Error) {
          if (data.stack) {
            const lines = data.stack.split('\n')
            if (lines.length > 1) {
              output += `${LABELS.FAIL}  ${name}\n`
              output += `     ${lines.join('\n     ')}\n`
            } else {
              output += `${LABELS.FAIL}  ${name}  ${lines[0]}\n`
            }
          } else {
            output += `${LABELS.FAIL}  ${name}  (no stack trace)\n`
          }
        } else if (typeof data === 'string') {
          output += `${LABELS.FAIL}  ${name}  ${data}\n`
        } else {
          output += `${LABELS.FAIL}  ${name}  ${inspect(data)}\n`
        }
        failed++
      }
    }

    /** Print the output to the console. */
    console.log(output)

  }

  console.info(`${passed} test(s) passed, ${failed} failed, ${undone} TODO.`)

  /** If any test failed, exit with an error. */
  if (failed > 0) {
    process.exit(1)
  }

}

/** If this program is invoked from the command line, its first argument
  * should be the path to a module that exports-default a test suite. */
if (require.main === module) {
  const index = require('path').resolve(process.cwd(), process.argv[2])
  import(index).then(index=>{
    runSpec(index.default, process.argv.slice(3))
  }).catch(e=>{
    console.error(e)
    process.exit(2)
  })
}
