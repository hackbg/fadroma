import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'
import { Path } from '@hackbg/file'

export type Version = `0.34.3`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '0.34.3': version('0.34.3'),
}

export function version (v: Version) {
  return {
    platformName: 'axelar' as Lowercase<keyof typeof Platform>,
    platformVersion: v,
    Connection: CW.CWConnection as { new (...args: unknown[]): Chain.Connection },
    Identity: CW.CWMnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken: new Token.Native('uarch'),
    nodeBinary: 'axelard',
    bech32Prefix: 'axelar',
    nodePortMode: 'rpc' as APIMode,
    waitString: 'indexed block',
    container: {
      image: {
        name: `ghcr.io/hackbg/fadroma-devnet-axelar:${v}`,
        dockerfile: new Path(packageRoot, 'platforms', `axelar.Dockerfile`).absolute,
        inputFiles: [`devnet.init.mjs`]
      }
    },
  }
}
