import Btc     from './Btc.ts';
import BtcRpc  from './BtcRpc.ts';
import BtcRest from './BtcRest.ts';
import Daemon  from './BtcDaemon.ts';
import Esplora from './Esplora.ts';
import { Liquid1, LiquidTestnet } from './Liquid.ts';

export default Btc;

export { Daemon, BtcRpc, BtcRest, Esplora, Liquid1, LiquidTestnet };

import type { pubECDSA } from 'npm:@scure/btc-signer/utils.js';
import { p2wpkh } from 'npm:@scure/btc-signer';
import { Obj } from '../../library/Obj.ts';

/** Connect to Bitcoin mainnet. */
export function BitcoinMainnet (options?: Btc.Options) {
  return Obj(Btc(options), BitcoinMainnet);
}

/** Mainnet specifics. */
export namespace BitcoinMainnet { /* TODO */ }

/** Connect to Bitcoin testnet. */
export function BitcoinTestnet (options?: Btc.Options) {
  return Obj(Btc(options), BitcoinTestnet);
}

/** Testnet specifics. */
export namespace BitcoinTestnet { /* TODO */ }

/** Spawn Elements in `elementsregtest` mode with Simplicity enabled. */
export async function ElementsRegtest (options?: Daemon.Options) {
  return Obj(Daemon({
    chain:                       ElementsRegtest.ID,
    bech32_hrp:                  ElementsRegtest.HRP_BECH32,
    blech32_hrp:                 ElementsRegtest.HRP_BLECH32,
    blindedprefix:               ElementsRegtest.PREFIX_BLIND,
    pubkeyprefix:                ElementsRegtest.PREFIX_PUBKEY,
    scriptprefix:                ElementsRegtest.PREFIX_SCRIPT,
    initialfreecoins:            ElementsRegtest.INITIAL_COINS,
    initialreissuancetokens:     ElementsRegtest.INITIAL_REISSUE,

    vbparams:                    "taproot:1:1",
    evbparams:                   'simplicity:-1:::',
    acceptnonstdtxn:             true,
    anyonecanspendaremine:       true,
    blindedaddresses:            true,
    con_blocksubsidy:            0,
    con_connect_genesis_outputs: true,
    con_elementsmode:            true,
    defaultpeggedassetname:      'bitcoin',
    maxtxfee:                    100.0,
    validatepegin:               false,
    //feeasset:                  BITCOIN,
    //subsidyasset:              BITCOIN,

    persistmempool:              false,
    discover:                    false,
    dnsseed:                     false,
    server:                      true,
    txindex:                     true,

    rest:                        true,
    rpcallowip:                  '127.0.0.1',
    rpcpassword:                 'fadroma',
    rpcport:                     8941,
    rpcuser:                     'fadroma',

    ...options,
  }), ElementsRegtest);
}

export namespace ElementsRegtest {
  export const ID            = 'elementsregtest';
  export const HRP_BECH32    = 'ert';
  export const HRP_BLECH32   = 'el';
  export const PREFIX_P2PKH  = 235;
  export const PREFIX_P2SH   = 75;
  export const PREFIX_BLIND  = 4;
  export const PREFIX_PUBKEY = 36;
  export const PREFIX_SCRIPT = 13;
  export const P2WPKH = (x: ReturnType<typeof pubECDSA>) => {
    return p2wpkh(x, {
      bech32: HRP_BECH32, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef,
    });
  }
  export const BITCOIN         = 100000000n;
  export const INITIAL_COINS   = BITCOIN * 1000000n;
  export const INITIAL_REISSUE = BITCOIN * 1n;
  /** Well-known asset IDs for Bitcoin. */
  export const ASSETS = {
    /** Asset ID for Bitcoin. */
    DEFAULT: 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23',
    /** Asset ID for default initial reissuance token. */
    REISSUE: 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61',
  };
}
