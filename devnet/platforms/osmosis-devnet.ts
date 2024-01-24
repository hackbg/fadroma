import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'
import { Path } from '@hackbg/file'

export type Version = `22.0.1`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '22.0.1': version('22.0.1'),
}

export function version (v: Version) {
  return {
    platformName: 'osmosis' as Lowercase<keyof typeof Platform>,
    platformVersion: v,
    Connection: CW.CWConnection as { new (...args: unknown[]): Chain.Connection },
    Identity: CW.CWMnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken: new Token.Native('uosmo'),
    nodeBinary: 'osmosisd',
    nodePortMode: 'rpc' as APIMode,
    waitString: 'indexed block',
    container: {
      image: {
        name: `ghcr.io/hackbg/fadroma-devnet-osmosis:${v}`,
        dockerfile: new Path(packageRoot, 'platforms', `osmosis.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      }
    },
  }
}
