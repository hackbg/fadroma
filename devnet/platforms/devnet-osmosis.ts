import * as PlatformBase from '../devnet-platform-base'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'

export type Version = `22.0.1`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '22.0.1': version(
    '22.0.1',
    'osmolabs/osmosis:22.0.1-alpine',
    '71511ed82fecfc6b9d72ea5a2f07ca4373e4222e1ffaa96c891013306af9e570'
  ),
}

export function version (platformVersion: Version, baseImage: string, baseSha256: string) {
  const platformName: Lowercase<keyof typeof Platform> = 'osmosis'
  const image = PlatformBase.alpineDevnet({ platformName, platformVersion, baseImage, baseSha256 })
  return {
    platformName,
    platformVersion,
    Connection:   CW.CWConnection as { new (...args: unknown[]): Chain.Connection },
    Identity:     CW.CWMnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken:     new Token.Native('uosmo'),
    nodeBinary:   'osmosisd',
    bech32Prefix: 'osmo',
    nodePortMode: 'rpc' as APIMode,
    waitString:   'indexed block',
    container:    { image },
  }
}
