import runTest from '@hackbg/runspec'
import suites from './ops/index.spec.js.md'
import scrtSuites from './scrt/index.spec.ts'
runTest({...suites, ...scrtSuites}, process.argv.slice(2))
