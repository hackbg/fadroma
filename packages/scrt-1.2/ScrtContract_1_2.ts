import { ContractAPI } from '@fadroma/ops'
import { resolve, dirname, fileURLToPath } from '@fadroma/tools'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class ScrtContract extends ContractAPI {
  buildImage      = 'hackbg/fadroma-scrt-builder:1.2'
  buildDockerfile = resolve(__dirname, 'ScrtBuild_1_2.Dockerfile')
  buildScript     = resolve(__dirname, 'ScrtBuild_1_2.sh')
}
