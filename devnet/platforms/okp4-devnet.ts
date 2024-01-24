import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'
import { Path } from '@hackbg/file'

export type Version = `${5|6}.0`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '5.0': version('5.0'),
  '6.0': version('6.0'),
}

export function version (v: Version) {
  return {
    platformName: 'okp4' as Lowercase<keyof typeof Platform>,
    platformVersion: v,
    Connection: CW.OKP4Connection as { new (...args: unknown[]): Chain.Connection },
    Identity: CW.OKP4MnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken: new Token.Native('uknow'),
    nodeBinary: 'okp4d',
    nodePortMode: 'rpc' as APIMode,
    waitString: 'indexed block',
    container: {
      image: {
        name: `ghcr.io/hackbg/fadroma-devnet-okp4:${v}`,
        dockerfile: new Path(packageRoot, 'platforms', `okp4-${v}.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      }
    },
  }
}
