import { ContractAPI, buildScript } from '@fadroma/scrt'
import { resolve, dirname, fileURLToPath } from '@fadroma/tools'

const
  __dirname       = dirname(fileURLToPath(import.meta.url)),
  buildImage      = 'hackbg/fadroma-scrt-builder:1.0',
  buildDockerfile = resolve(__dirname, 'ScrtBuild_1_0.Dockerfile')

export { buildImage, buildDockerfile, buildScript }

export class ScrtContract_1_0 extends ContractAPI {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}
