const assert = require('assert')
const { inspect } = require('util')

Error.stackTraceLimit = 100

const OK   = 'OK   💚 '
const FAIL = 'FAIL 💔 '

module.exports         = runSpec
module.exports.default = runSpec
module.exports.runSpec = runSpec

async function runSpec (suites, selected = []) {

  let passed = 0
  let failed = 0

  for (const [suite, spec] of Object.entries(suites)) {

    if (selected.length > 0 && !selected.includes(suite)) {
      continue
    }

    const tests   = {}
    const results = {}

    let longestName = 0
    for (const [name, fn] of Object.entries(spec)) {
      if (name.length > longestName) longestName = name.length
      try {
        tests[name] = () => {
          try {
            const result = fn(assert)
            return Promise.resolve(result)
              .then(data=>results[name] = [true, JSON.stringify(data)])
              .catch(error=>results[name] = [false, error])
          } catch (error) {
            results[name] = [false, error]
          }
        }
      } catch (error) {
        tests[name] = error.message
        results[name] = [false, error]
        continue
      }
    }

    await Promise.all(Object.values(tests).map(run=>run()))

    let output = `\n${suite}\n`
    for (let [name, [result, data]] of Object.entries(results)) {
      name = name.padEnd(longestName)
      if (result) {
        if (data === undefined) data = ''
        output += `${OK}  ${name}  ${data}\n`
        passed++
      } else {
        if (data instanceof Error) {
          const lines = data.stack.split('\n')
          if (lines.length > 1) {
            output += `${FAIL}  ${name}\n`
            output += `     ${lines.join('\n     ')}\n`
          } else {
            output += `${FAIL}  ${name}  ${lines[0]}\n`
          }
        } else if (typeof data === 'string') {
          output += `${FAIL}  ${name}  ${data}\n`
        } else {
          output += `${FAIL}  ${name}  ${inspect(data)}\n`
        }
        failed++
      }
    }

    console.log(output)

  }

  if (failed > 0) {
    console.error(`${passed} test(s) passed, ${failed} failed.`)
    process.exit(1)
  }

}
