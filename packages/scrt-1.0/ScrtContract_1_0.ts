import { buildScript, resolve, dirname, fileURLToPath, } from '@fadroma/scrt'

const
  __dirname       = dirname(fileURLToPath(import.meta.url)),
  buildImage      = 'hackbg/fadroma-scrt-builder:1.0',
  buildDockerfile = resolve(__dirname, 'ScrtBuild_1_0.Dockerfile')

export { buildImage, buildDockerfile }

import { BaseContract } from '@fadroma/scrt'
export class ScrtContract_1_0 extends BaseContract {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}
import { AugmentedScrtContract } from '@fadroma/scrt'
export class AugmentedScrtContract_1_0<T, Q> extends AugmentedScrtContract<T, Q> {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}
