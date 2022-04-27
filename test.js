// test that the whole thing loads,
// starting from the entrypoint for downstream:
import './index.ts'

// run the test suites
import runTest  from '@hackbg/runspec'
import ops      from './packages/ops/index.spec.js.md'
import scrt     from './packages/scrt/index.spec.ts'
import scrt_1_2 from './packages/scrt-1.2/index.spec.ts'
import scrt_1_3 from './packages/scrt-1.3/index.spec.ts'

runTest({
  ...ops,
  ...scrt,
  ...scrt_1_2,
  ...scrt_1_3
}, process.argv.slice(2))
