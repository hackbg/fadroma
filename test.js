import './index.ts'

import runTest    from '@hackbg/runspec'
import opsSuites  from './packages/ops/index.spec.js.md'
import scrtSuites from './packages/scrt/index.spec.ts'
runTest({...opsSuites, ...scrtSuites}, process.argv.slice(2))
