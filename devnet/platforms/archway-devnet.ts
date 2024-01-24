import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'
import { Path } from '@hackbg/file'

export type Version = `4.0.3`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '4.0.3': version('4.0.3'),
}

export function version (v: Version) {
  return {
    platformName: 'archway' as Lowercase<keyof typeof Platform>,
    platformVersion: v,
    Connection: CW.CWConnection as { new (...args: unknown[]): Chain.Connection },
    Identity: CW.CWMnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken: new Token.Native('uarch'),
    nodeBinary: 'archwayd',
    nodePortMode: 'rpc' as APIMode,
    waitString: 'indexed block',
    container: {
      image: {
        name: `ghcr.io/hackbg/fadroma-devnet-archway:${v}`,
        dockerfile: new Path(packageRoot, 'platforms', `archway.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      }
    },
  }
}

