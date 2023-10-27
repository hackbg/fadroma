import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['agent',   () => import('./agent/agent.test')],
  ['build',   () => import('./ops/build.test')],
  ['connect', () => import('./connect/connect.test')],
  ['deploy',  () => import('./ops/deploy.test')],
  ['devnet',  () => import('./ops/devnet.test')],
  ['project', () => import('./ops/project.test')],
  ['upload',  () => import('./ops/upload.test')],
  ['wizard',  () => import('./ops/wizard.test')],
  //['project',      testProject],
  //['deploy-store', testDeployStore],
  //['upload-store', testUploadStore],
  //['factory', () => import ('./Factory.spec.ts.md')],
  //['impl',    () => import('./Implementing.spec.ts.md')],
])
