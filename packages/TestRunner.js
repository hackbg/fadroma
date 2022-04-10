import runTest from '@ganesha/runspec'
import suites from './ops/index.spec.js.md'
import scrtSuites from './scrt/Scrt.spec.ts.md'
runTest({...suites, ...scrtSuites}, process.argv.slice(2))
