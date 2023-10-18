import testEntrypoint, { testSuite } from './testSelector'

testEntrypoint(import.meta.url, {
  'agent':   testSuite('./Agent.test'),
  'build':   testSuite('./Build.test'),
  'connect': testSuite('./Connect.test'),
  'cw':      testSuite('./CW.test'),
  'deploy':  testSuite('./Deploy.test'),
  'devnet':  testSuite('./Devnet.test'),
  'factory': testSuite('./Devnet.spec.ts.md'),
  'impl':    testSuite('./Implementing.spec.ts.md'),
  'mocknet': testSuite('./Mocknet.test'),
  'project': testSuite('./Project.test'),
  'scrt':    testSuite('./Scrt.test'),
  'snip20':  testSuite('./Snip20.spec.ts.md'),
  'upload':  testSuite('./Upload.test'),
  'util':    testSuite('./Util.test'),
})
