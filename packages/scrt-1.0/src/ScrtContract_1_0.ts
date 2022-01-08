import { ContractAPI } from '@fadroma/scrt'
import { resolve, dirname, fileURLToPath } from '@fadroma/tools'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class ScrtContract_1_0 extends ContractAPI {
  buildImage      = 'hackbg/fadroma-scrt-builder:1.0'
  buildDockerfile = resolve(__dirname, 'ScrtBuild_1_0.Dockerfile')
  buildScript     = resolve(__dirname, 'ScrtBuild_1_0.sh')
}
