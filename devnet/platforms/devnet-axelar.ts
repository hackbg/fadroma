import * as PlatformBase from '../devnet-platform-base'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'

export type Version = `0.34.3`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '0.34.3': version(
    '0.34.3',
    'axelarnetwork/axelar-core:v0.34.3',
    '6e99f8913054bbd81b8fe248c8c6ade736bc751f822ae6f9556cc0b8fe3a998d'
  ),
}

export function version (platformVersion: Version, baseImage: string, baseSha256: string) {
  const platformName: Lowercase<keyof typeof Platform> = 'axelar'
  const image = PlatformBase.alpineDevnet({ platformName, platformVersion, baseImage, baseSha256 })
  return {
    platformName,
    platformVersion,
    Connection:   CW.Axelar.Connection as { new (...args: unknown[]): Chain.Connection },
    Identity:     CW.Axelar.MnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken:     new Token.Native('uarch'),
    nodeBinary:   'axelard',
    bech32Prefix: 'axelar',
    nodePortMode: 'rpc' as APIMode,
    waitString:   'indexed block',
    container:    { image }
  }
}
