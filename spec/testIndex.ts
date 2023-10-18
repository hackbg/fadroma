import testEntrypoint, { testSuite } from './testSelector'

export default testEntrypoint(import.meta.url, {
  'agent':   testSuite('./Agent.test'),
  'build':   testSuite('./Build.test'),
  'connect': testSuite('./Connect.test'),
  'cw':      testSuite('./CW.test'),
  'deploy':  testSuite('./Deploy.test'),
  'devnet':  testSuite('./Devnet.test'),
  'factory': () => import ('./Factory.spec.ts.md'),
  //'impl':    () => import('./Implementing.spec.ts.md'),
  'mocknet': testSuite('./Mocknet.test'),
  'project': testSuite('./Project.test'),
  'scrt':    testSuite('./Scrt.test'),
  //'snip20':  () => import('./Snip20.spec.ts.md'),
  'upload':  testSuite('./Upload.test'),
  'util':    () => import('./Util.spec.ts.md'),
})
