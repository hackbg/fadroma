/*
  Based on:
  - https://hub.docker.com/r/enigmampc/localsecret
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/release.Dockerfile
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/dev-image.Dockerfile
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/docker/devimage/bootstrap_init_no_stop.sh ???
*/

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config, DockerodeDevnet, DockerImage } from '@fadroma/ops'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function getScrtDevnet_1_3 () {
  return new DockerodeDevnet({
    image: new DockerImage(
      undefined,
      'enigmampc/secret-network-sw-dev:v1.3.0-beta.0'
    ),
    readyPhrase: "indexed block",
    initScript:  resolve(__dirname, 'devnet_1_3.sh'),
    port:        9091
  })
}

export function getScrtDevnet_1_2 (
  managerURL: string = config.devnetManager,
  chainId?:   string,
) {
  if (managerURL) {
    throw new Error('unimplemented: managed devnets will be available in a future release of Fadroma')
    //return ManagedDevnet.getOrCreate(
      //managerURL, chainId, config.scrt.devnetChainIdPrefix
    //)
  } else {
    return new DockerodeDevnet({
      image: new DockerImage(
        undefined,
        "enigmampc/secret-network-sw-dev:v1.2.0",
      ),
      readyPhrase: "indexed block",
      initScript:  resolve(__dirname, 'devnet_1_2.sh')
    })
  }
}
