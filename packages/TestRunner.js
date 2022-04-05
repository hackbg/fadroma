#!/usr/bin/env node
import assert from 'assert'

Error.stackTraceLimit = 100

const OK   = '💚 '
const FAIL = '💔 '

import suites from './ops/index.spec.js.md'
import scrtSuites from './scrt/Scrt.spec.ts.md'
runTests({...suites, ...scrtSuites})

async function runTests (suites) {

  let passed = 0
  let failed = 0

  for (const [suite, spec] of Object.entries(suites)) {
    const tests   = {}
    const results = {}

    let longestName = 0
    for (const [name, fn] of Object.entries(spec)) {
      if (name.length > longestName) longestName = name.length
      try {
        tests[name] = () => Promise.resolve(fn(assert))
          .then(data=>results[name] = [true, JSON.stringify(data)])
          .catch(error=>results[name] = [false, error])
      } catch (error) {
        tests[name] = error.message
        results[name] = [false, error]
        continue
      }
    }

    await Promise.all(Object.values(tests).map(run=>run())).then(()=>{
      let output = `\n${suite}\n`
      let testFailed = false
      for (let [name, [result, data]] of Object.entries(results)) {
        name = name.padEnd(longestName)
        if (result) {
          if (data === undefined) data = ''
          output += `${OK}  ${name}  ${data}\n`
          passed ++
        } else {
          output += `${FAIL}  ${name}  ${data}\n`
          failed ++
        }
      }
      console.log(output)
    })
  }

  console.log(`${passed} passed, ${failed} failed`)

}

