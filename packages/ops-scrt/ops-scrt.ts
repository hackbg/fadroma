/**
 
  Fadroma Ops for Secret Network
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

  Based on:
    - https://hub.docker.com/r/enigmampc/localsecret
    - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/release.Dockerfile
    - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/dev-image.Dockerfile
    - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/docker/devimage/bootstrap_init_no_stop.sh ???

*/

import { resolve, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Dokeres } from '@hackbg/dokeres'
import {
  DockerDevnet,
  RemoteDevnet,
  DevnetPortMode,
  DockerBuilder,
  RawBuilder,
} from '@fadroma/ops'

export * from '@fadroma/ops'

export const __dirname = dirname(fileURLToPath(import.meta.url))

export default class SecretNetwork {
  static getBuilder = getScrtBuilder
  static getDevnet  = getScrtDevnet
}

export interface ScrtBuilderOptions {
  rebuild:    boolean
  caching:    boolean
  raw:        boolean
  managerUrl: string|URL
  image:      string
  dockerfile: string
  script:     string
  service:    string
  noFetch:    boolean
  toolchain:  string
}

export function getScrtBuilder ({
  rebuild,
  caching = !rebuild,
  raw,
  managerUrl,
  image,
  dockerfile,
  service,
  script,
  toolchain,
  noFetch
}: Partial<ScrtBuilderOptions> = {}) {
  if (raw) {
    return new ScrtRawBuilder({
      caching,
      script,
      noFetch,
      toolchain
    })
  } else if (managerUrl) {
    throw new Error('unimplemented: managed builder will be available in a future version of Fadroma')
    //return new ManagedBuilder({ managerURL })
  } else {
    return new ScrtDockerBuilder({
      caching,
      script,
      image,
      dockerfile,
      service
    })
  }
}

export class ScrtRawBuilder extends RawBuilder {}

export class ScrtDockerBuilder extends DockerBuilder {
  static dockerfile = resolve(__dirname, 'build.Dockerfile')
  static script     = resolve(__dirname, 'build-impl.mjs')
  static service    = resolve(__dirname, 'build-server.mjs')
  constructor ({
    caching,
    image,
    dockerfile = ScrtDockerBuilder.dockerfile,
    script     = ScrtDockerBuilder.script,
    service    = ScrtDockerBuilder.service
  }: Partial<ScrtBuilderOptions> = {}) {
    super({
      caching,
      script,
      image: new Dokeres().image(
        image,
        dockerfile,
        [script, service].map(x=>relative(dirname(dockerfile), x))
      )
    })
  }
}

export type ScrtDevnetVersion = '1.2'|'1.3'

export class ScrtDevnet extends DockerDevnet {
  static dockerfiles: Record<ScrtDevnetVersion, string> = {
    '1.2': resolve(__dirname, 'devnet_1_2.Dockerfile'),
    '1.3': resolve(__dirname, 'devnet_1_3.Dockerfile')
  }
  static dockerTags: Record<ScrtDevnetVersion, string> = {
    '1.2': 'fadroma/scrt-devnet:1.2',
    '1.3': 'fadroma/scrt-devnet:1.3',
  }
  static portModes: Record<ScrtDevnetVersion, DevnetPortMode> = {
    '1.2': 'lcp',
    '1.3': 'grpcWeb'
  }
  static initScriptName    = 'devnet-init.mjs'
  static managerScriptName = 'devnet-manager.mjs'
}

export function getScrtDevnet (
  version:    ScrtDevnetVersion,
  managerURL: string  = undefined,
  chainId:    string  = undefined,
  dokeres:    Dokeres = new Dokeres()
) {
  const portMode = ScrtDevnet.portModes[version]
  if (managerURL) {
    return RemoteDevnet.getOrCreate(
      managerURL,
      chainId,
      chainId ? null : chainId,
      portMode
    )
  } else {
    const dockerfile  = ScrtDevnet.dockerfiles[version]
    const imageTag    = ScrtDevnet.dockerTags[version]
    const readyPhrase = 'indexed block'
    const initScript  = resolve(__dirname, ScrtDevnet.initScriptName)
    const image       = dokeres.image(imageTag, dockerfile, [
      ScrtDevnet.initScriptName,
      ScrtDevnet.managerScriptName
    ])
    return new DockerDevnet({ portMode, image, readyPhrase, initScript })
  }
}
