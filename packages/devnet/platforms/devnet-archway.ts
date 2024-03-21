import * as PlatformBase from '../devnet-platform-base'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'

export type Version = `4.0.3`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '4.0.3': version(
    '4.0.3',
    'archwaynetwork/archwayd:4.0.3',
    '738f0d04be3a60bd5014706a516bc8c6bbb29c128c4b073eb773544ef382a337'
  ),
}

export function version (platformVersion: Version, baseImage: string, baseSha256: string) {
  const platformName: Lowercase<keyof typeof Platform> = 'archway'
  const image = PlatformBase.alpineDevnet({ platformName, platformVersion, baseImage, baseSha256 })
  return {
    platformName,
    platformVersion,
    Connection:   CW.Archway.Connection as { new (...args: unknown[]): Chain.Connection },
    Identity:     CW.Archway.MnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken:     new Token.Native('uarch'),
    nodeBinary:   'archwayd',
    bech32Prefix: 'archway',
    nodePortMode: 'rpc' as APIMode,
    waitString:   'indexed block',
    container:    { image }
  }
}
