import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import * as OCI from '@fadroma/oci'
import { Path } from '@hackbg/file'

export type Version = `1.${9|10|11|12}`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '1.9':  version('1.9'),
  '1.10': version('1.10'),
  '1.11': version('1.11'),
  '1.12': version('1.12')
}

export function version (v: Version) {
  return {
    nodePortMode: 'http' as APIMode,
    waitString:   'Validating proposal',
    nodeBinary:   'secretd',
    platform:     `scrt-${v}`,
    container:    new OCI.Container({
      image: new OCI.Image({
        name: `ghcr.io/hackbg/fadroma-devnet-scrt-${v}:master`,
        dockerfile: new Path(packageRoot, 'platforms', `scrt-${v}.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      })
    }),
  }
}
