import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as Scrt from '@fadroma/scrt'
import { Chain, Token } from '@fadroma/agent'
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
    platformName: 'scrt' as Lowercase<keyof typeof Platform>,
    platformVersion: v,
    Connection: Scrt.ScrtConnection as { new (...args: unknown[]): Chain.Connection },
    Identity: Scrt.ScrtMnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken: new Token.Native('uscrt'),
    nodePortMode: 'http' as APIMode,
    waitString: 'Validating proposal',
    nodeBinary: 'secretd',
    container: {
      image: {
        name: `ghcr.io/hackbg/fadroma-devnet-scrt-${v}:master`,
        dockerfile: new Path(packageRoot, 'platforms', `scrt-${v}.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      }
    },
  }
}
