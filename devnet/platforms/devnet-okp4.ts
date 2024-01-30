import * as PlatformBase from '../devnet-platform-base'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'

export type Version = `${5|6}.0`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '5.0': version(
    '5.0',
    'okp4/okp4d:5.0.0',
    'b197462e61c068ea094ec9b5693c88c2850606f9eaf53fcbe08a0aa4f6ff90b9'
  ),
  '6.0': version(
    '6.0',
    'okp4/okp4d:6.0.0',
    '50f7404014863445d7d83b794ecd91b9a5337e5709a9d1dc19215e519c1acc4a'
  ),
}

export function version (platformVersion: Version, baseImage: string, baseSha256: string) {
  const platformName: Lowercase<keyof typeof Platform> = 'axelar'
  const image = PlatformBase.alpineDevnet({ platformName, platformVersion, baseImage, baseSha256 })
  return {
    platformName,
    platformVersion,
    Connection:   CW.OKP4Connection as { new (...args: unknown[]): Chain.Connection },
    Identity:     CW.OKP4MnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken:     new Token.Native('uknow'),
    nodeBinary:   'okp4d',
    bech32Prefix: 'okp4',
    nodePortMode: 'rpc' as APIMode,
    waitString:   'indexed block',
    container:    { image },
  }
}

/*
# {"jsonrpc":"2.0","id":595486116712,"method":"abci_query","params":{"path":"/cosmwasm.wasm.v1.Query/Codes","data":"","prove":false}}
# {"jsonrpc":"2.0","id":655138293622,"method":"abci_query","params":{"path":"/cosmwasm.wasm.v1.Query/Code","data":"0811","varprove":false}}
#curl --header 'Content-Type: application/json' --request POST --data '{"jsonrpc":"2.0","id":"fadroma","method":"abci_query","params":{"path":"/cosmwasm.wasm.v1.Query/Codes","data":"","prove":false}}' https://okp4-testnet-rpc.polkachu.com | jq -r .result.response.value | base64 -d | protoc --decode_raw
*/
