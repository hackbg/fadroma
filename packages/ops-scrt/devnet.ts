/*
  Based on:
  - https://hub.docker.com/r/enigmampc/localsecret
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/release.Dockerfile
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/dev-image.Dockerfile
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/docker/devimage/bootstrap_init_no_stop.sh ???
*/

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config, DockerodeDevnet, ManagedDevnet } from '@fadroma/ops'
import { Dokeres } from '@hackbg/dokeres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const initScript = 'devnet-init.mjs'

export function getScrtDevnet_1_3 (
  managerURL: string = config.devnetManager,
  chainId?:   string,
) {
  if (managerURL) {
    return ManagedDevnet.getOrCreate(
      managerURL, chainId, config.scrt.devnetChainIdPrefix
    )
  } else {
    const dockerfile = resolve(__dirname, 'devnet_1_2.Dockerfile')
    return new DockerodeDevnet({
      portMode:    'grpcWeb',
      image:       new Dokeres().image('fadroma/scrt-devnet:1.2', dockerfile, [initScript]),
      readyPhrase: 'indexed block',
      initScript:  resolve(__dirname, 'devnet-init.mjs'),
    })
  }
}

export function getScrtDevnet_1_2 (
  managerURL: string = config.devnetManager,
  chainId?:   string,
) {
  if (managerURL) {
    return ManagedDevnet.getOrCreate(
      managerURL, chainId, config.scrt.devnetChainIdPrefix
    )
  } else {
    const dockerfile = resolve(__dirname, 'devnet_1_3.Dockerfile')
    return new DockerodeDevnet({
      portMode:    'lcp',
      image:       new Dokeres().image('fadroma/scrt-devnet:1.3', dockerfile, [initScript]),
      readyPhrase: 'indexed block',
      initScript:  resolve(__dirname, 'devnet-init.mjs')
    })
  }
}
