import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import * as OCI from '@fadroma/oci'
import { Path } from '@hackbg/file'

export type Version = `1.${9|10|11|12}`

export function version (v: Version) {
  let waitString
  let nodePortMode: APIMode
  const image = new OCI.Image({
    name: `ghcr.io/hackbg/fadroma-devnet-scrt-${v}:master`,
    dockerfile: new Path(packageRoot, 'platforms', `scrt-${v}.Dockerfile`).absolute,
    inputFiles: [`devnet.init.mjs`]
  })
  return {
    nodePortMode: 'http' as APIMode,
    waitString:   'Validating proposal',
    nodeBinary:   'secretd',
    platform:     `scrt-${v}`,
    container:    new OCI.Container({ image }),
  }
}

