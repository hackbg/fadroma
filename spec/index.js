// test that the whole thing loads,
// starting from the entrypoint for downstream:
import '../index.ts'

// Import the specification and run it.
import Specification from './README.md'
import runSpec from '@hackbg/runspec'
runSpec(Specification, process.argv.slice(2))
