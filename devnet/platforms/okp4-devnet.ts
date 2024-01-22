import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import * as OCI from '@fadroma/oci'
import { Path } from '@hackbg/file'

export type Version = `${5|6}.0`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '5.0': version('5.0'),
  '6.0': version('6.0'),
}

export function version (v: Version) {
  return {
    nodeBinary:   'okp4d',
    nodePortMode: 'rpc' as APIMode,
    platform:     `okp4-${v}`,
    waitString:   'indexed block',
    container:    new OCI.Container({
      image: new OCI.Image({
        name: `ghcr.io/hackbg/fadroma-devnet-okp4-${v}:master`,
        dockerfile: new Path(packageRoot, 'platforms', `okp4-${v}.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      })
    }),
  }
}
