import { CosmWasmClient, SigningCosmWasmClient, serializeSignDoc } from '@hackbg/cosmjs-esm'
import { Core, Chain } from '@fadroma/agent'
import { CWError as Error, bold, bip32, bip39, bip39EN, bech32, base64 } from './cw-base'
import type { OfflineSigner } from '@hackbg/cosmjs-esm'
import { ripemd160 } from "@noble/hashes/ripemd160"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1"
import { numberToBytesBE } from "@noble/curves/abstract/utils"

export class CWIdentity extends Chain.Identity {
  declare signer: OfflineSigner
}

export class CWSignerIdentity extends CWIdentity {
  constructor ({ signer, ...properties }: Partial<Chain.Identity & {
    signer: OfflineSigner
  }>) {
    super(properties)
    if (!signer) {
      throw new Error("signer not set")
    }
    this.signer = signer
  }
  sign () {
  }
}

export class CWMnemonicIdentity extends CWIdentity {
  bech32Prefix:   string
  coinType:       number
  hdAccountIndex: number
  pubkey:         Uint8Array
  constructor ({
    bech32Prefix,
    coinType,
    hdAccountIndex,
    mnemonic,
    generateMnemonic = true,
    ...properties
  }: Partial<Chain.Identity & {
    bech32Prefix:     string
    coinType:         number
    hdAccountIndex:   number
    mnemonic:         string
    generateMnemonic: boolean
  }>) {
    super(properties)
    // Validate input
    if (bech32Prefix === undefined) {
      throw new Error('bech32Prefix is not set')
    }
    if (coinType === undefined) {
      throw new Error('coinType is not set')
    }
    if (hdAccountIndex === undefined) {
      throw new Error('hdAccountIndex is not set')
    }
    this.bech32Prefix = bech32Prefix
    this.coinType = coinType
    this.hdAccountIndex = hdAccountIndex
    let generatedMnemonic = false
    if (!mnemonic) {
      if (generateMnemonic) {
        mnemonic = bip39.generateMnemonic(bip39EN)
        generatedMnemonic = true
      } else {
        throw new Error("mnemonic is not set")
      }
    }
    // Derive keypair and address from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    const node = bip32.HDKey.fromMasterSeed(seed)
    const secretHD = node.derive(`m/44'/${this.coinType}'/0'/0/${this.hdAccountIndex}`)
    const privateKey = secretHD.privateKey
    if (!privateKey) {
      throw new Error("failed to derive key pair")
    }
    const pubkey = secp256k1.getPublicKey(new Uint8Array(privateKey), true);
    const address = bech32.encode(this.bech32Prefix, bech32.toWords(ripemd160(sha256(pubkey))))
    if (this.address && this.address !== address) {
      throw new Error(
        `address ${address} generated from mnemonic did not match ${this.address}`
      )
    }
    const loggerColor = Core.randomColor({ luminosity: 'dark', seed: address })
    this.log.label = Core.colors.whiteBright.bgHex(loggerColor)(` ${this.name||address} `)
    if (generatedMnemonic) {
      this.log.info('Generated mnemonic:', bold(mnemonic))
      this.log.warn('Generated mnemonic will not be displayed again.')
    }
    this.address = address
    this.pubkey = pubkey
    this.signer = {
      // One account per agent
      getAccounts: async () => [{ algo: 'secp256k1', address, pubkey }],
      // Sign a transaction
      signAmino: async (address2: string, signed: any) => {
        if (address2 && address2 !== address) {
          this.log.warn(`Received address ${bold(address)} that did not match`)
            .warn(` generated address ${address}, ignoring them`)
        }
        const { r, s } = secp256k1.sign(sha256(serializeSignDoc(signed)), privateKey)
        return {
          signed,
          signature: encodeSecp256k1Signature(pubkey, new Uint8Array([
            ...numberToBytesBE(r, 32), ...numberToBytesBE(s, 32)
          ])),
        }
      },
    }
  }
}

export function encodeSecp256k1Signature (pubkey: Uint8Array, signature: Uint8Array): {
  pub_key: { type: string, value: string },
  signature: string
} {
  if (pubkey.length !== 33 || (pubkey[0] !== 0x02 && pubkey[0] !== 0x03)) {
    throw new Error(
      "Public key must be compressed secp256k1, i.e. 33 bytes starting with 0x02 or 0x03"
    )
  }
  if (signature.length !== 64) {
    throw new Error(
      "Signature must be 64 bytes long. Cosmos SDK uses a 2x32 byte fixed length encoding "+
      "for the secp256k1 signature integers r and s."
    )
  }
  return {
    pub_key: { type: "tendermint/PubKeySecp256k1", value: base64.encode(pubkey), },
    signature: base64.encode(signature)
  }
}

export default {
  Mnemonic: CWMnemonicIdentity,
  Signer:   CWSignerIdentity
}
