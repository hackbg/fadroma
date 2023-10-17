import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = dirname(dirname(resolve(fileURLToPath(import.meta.url))))

export default async function testEntrypoint (url: string, tests: Record<string, Function>) {

  if (resolve(process.argv[2]) === resolve(fileURLToPath(url))) {
    await pickTest(tests)
  } else {
    await testAll(tests)
  }

}

export async function pickTest (tests: Record<string, Function>) {
  if (process.argv[3] === 'all') {
    return testAll(tests)
  }
  const test = tests[process.argv[3]]
  if (test) {
    await test()
  } else {
    console.log('\nSpecify suite to run:')
    console.log(`  all`)
    for (const test of Object.keys(tests)) {
      console.log(`  ${test}`)
    }
    console.log()
    process.exit(1)
  }
}

export async function testAll (tests: Record<string, Function>) {
  const runs = Object.values(tests).map(test=>test())
  return await Promise.all(runs)
}
