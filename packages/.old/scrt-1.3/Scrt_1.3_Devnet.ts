import { DockerodeDevnet, DockerImage } from '@fadroma/ops'

export function getScrt_1_3_Devnet () {
  return new DockerodeDevnet({
    image: new DockerImage(
      undefined,
      'enigmampc/secret-network-sw-dev:v1.3.0-beta.0'
    )
  })
}
