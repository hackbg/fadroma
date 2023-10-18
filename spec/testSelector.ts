import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = dirname(dirname(resolve(fileURLToPath(import.meta.url))))

export default function testEntrypoint (url: string, tests: Record<string, Function>) {
  const entrypoint = resolve(process.argv[2])
  const mainScript = resolve(fileURLToPath(url))
  if (entrypoint === mainScript) return pickTest(tests)
  return tests
}

export async function pickTest (tests: Record<string, Function>, picked = process.argv[3]) {
  if (picked === 'all') return testAll(tests)
  const test = tests[picked]
  if (test) return await test()
  console.log('\nSpecify suite to run:')
  console.log(`  all`)
  for (const test of Object.keys(tests)) {
    console.log(`  ${test}`)
  }
  console.log()
  process.exit(1)
}

export async function testAll (tests: Record<string, Function>) {
  const runs = Object.values(tests).map(test=>test())
  return await Promise.all(runs)
}

export function testSuite (path: string) {
  return async () => {
    console.log('Testing:', path)
    const { default: suite } = await import(path)
    return pickTest(suite, process.argv[4])
  }
}
