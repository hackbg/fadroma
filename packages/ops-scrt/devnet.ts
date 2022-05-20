/*
  Based on:
  - https://hub.docker.com/r/enigmampc/localsecret
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/release.Dockerfile
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/dev-image.Dockerfile
  - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/docker/devimage/bootstrap_init_no_stop.sh ???
*/

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DockerodeDevnet, ManagedDevnet, DevnetPortMode } from '@fadroma/ops'
import { Dokeres } from '@hackbg/dokeres'

import { scrtConfig as config } from './config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type ScrtDevnetVersion = '1.2'|'1.3'

export const scrtDevnetDockerfiles: Record<ScrtDevnetVersion, string> = {
  '1.2': resolve(__dirname, 'devnet_1_2.Dockerfile'),
  '1.3': resolve(__dirname, 'devnet_1_3.Dockerfile')
}

export const scrtDevnetDockerTags: Record<ScrtDevnetVersion, string> = {
  '1.2': 'fadroma/scrt-devnet:1.2',
  '1.3': 'fadroma/scrt-devnet:1.3',
}

export const scrtDevnetPortModes: Record<ScrtDevnetVersion, DevnetPortMode> = {
  '1.2': 'lcp',
  '1.3': 'grpcWeb'
}

const initScriptName    = 'devnet-init.mjs'
const managerScriptName = 'devnet-manager.mjs'
const scripts           = [initScriptName, managerScriptName]

export function getScrtDevnet (
  version:    ScrtDevnetVersion,
  managerURL: string = config.devnetManager,
  chainId:    string = undefined,
  dokeres:    Dokeres = new Dokeres()
) {
  const portMode = scrtDevnetPortModes[version]
  if (managerURL) {
    return ManagedDevnet.getOrCreate(
      managerURL,
      chainId,
      chainId ? null : config.scrt.devnetChainIdPrefix,
      portMode
    )
  } else {
    const dockerfile  = scrtDevnetDockerfiles[version]
    const imageTag    = scrtDevnetDockerTags[version]
    const image       = dokeres.image(imageTag, dockerfile, scripts)
    const readyPhrase = 'indexed block'
    const initScript  = resolve(__dirname, initScriptName)
    return new DockerodeDevnet({ portMode, image, readyPhrase, initScript })
  }
}
