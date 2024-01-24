import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'
import { Path } from '@hackbg/file'

export type Version = `1.12.9-testnet`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '1.12.9-testnet': version('1.12.9-testnet'),
}

export function version (v: Version) {
  return {
    platformName: 'injective' as Lowercase<keyof typeof Platform>,
    platformVersion: v,
    Connection: CW.CWConnection as { new (...args: unknown[]): Chain.Connection },
    Identity: CW.CWMnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken: new Token.Native('uarch'),
    nodeBinary: 'injectived',
    bech32Prefix: 'inj',
    nodePortMode: 'rpc' as APIMode,
    waitString: 'indexed block',
    container: {
      image: {
        name: `ghcr.io/hackbg/fadroma-devnet-injective:${v}`,
        dockerfile: new Path(packageRoot, 'platforms', `injective.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      }
    },
  }
}
