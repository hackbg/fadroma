import type { pubECDSA } from 'npm:@scure/btc-signer/utils.js';
import { p2wpkh } from 'npm:@scure/btc-signer';
import { Obj } from '../../library/Obj.ts';

import Btc from './Btc.ts';

/** Connect to Liquid mainnet. */
export function Liquid1 (options = { esplora: Liquid1.ESPLORA_URL }) {
  return Obj(Btc(options), Liquid1);
}

export namespace Liquid1 {
  export const ID           = 'liquid1';
  export const RPC_URL      = null;
  export const REST_URL     = null;
  export const ESPLORA_URL  = 'https://blockstream.info/liquid1/api';
  export const HRP_BECH32   = 'ex';
  export const HRP_BLECH32  = 'lq';
  export const PREFIX_P2PKH = 57;
  export const PREFIX_P2SH  = 39;
  export const PREFIX_BLIND = 12;
  export const P2WPKH       = (x: ReturnType<typeof pubECDSA>) => p2wpkh(x, {
    bech32: HRP_BECH32, pubKeyHash: PREFIX_P2PKH, scriptHash: PREFIX_P2SH
  });
  /** Liquid Mainnet: Known asset IDs. */
  export const ASSETS       = { LBTC: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d' }
}

/** Connect to Liquid testnet. */
export function LiquidTestnet (options = { esplora: LiquidTestnet.ESPLORA_URL }) {
  return Obj(Btc(options), { ...LiquidTestnet });
}

export namespace LiquidTestnet {
  export const ID           = 'liquidtestnet';
  export const GENESIS      = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1'; // TODO autofetch from block 0
  export const RPC_URL      = null;
  export const REST_URL     = null;
  export const ESPLORA_URL  = 'https://blockstream.info/liquidtestnet/api';
  export const FAUCET_URL   = 'https://liquidtestnet.com/faucet';
  export const HRP_BECH32   = 'tex';
  export const HRP_BLECH32  = 'tlq';
  export const PREFIX_P2PKH = 36;
  export const PREFIX_P2SH  = 19;
  export const PREFIX_BLIND = 23;
  export function P2WPKH (ecdsaPubkey: Uint8Array) {
    const network = { bech32: 'tex', blech32: 'tlq', pubKeyHash: 36, scriptHash: 19, wif: 0xef };
    return p2wpkh(ecdsaPubkey, network);
  }
  /** Liquid Testnet: Known asset IDs. */
  export const ASSETS       = {
    DEFAULT: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
    LBTC:    '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
    TEST:    '38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5',
    AMP:     'bea126b86ac7f7b6fc4709d1bb1a8482514a68d35633a5580d50b18504d5c322',
  };
  /** Use these to return testnet assets so they don't eventually get depleted. */
  export const RETURN_ADDRS = {
    TEST: 'tlq1qq2g07nju42l0nlx0erqa3wsel2l8prnq96rlnhml262mcj7pe8w6ndvvyg237japt83z24m8gu4v3yfhaqvrqxydadc9scsmw',
    AMP:  'vjU8JWGnZu6XavzMEbLZ3mGZ3nrPxpwoBNC3brPi7CFm12sb7bHSkB4gz4SGSV9LhBceZVGaF8nsevu6',
  };
  export async function callFaucet (address: string) {
    const api = `https://liquidtestnet.com/api/faucet`;
    const url = `${api}?address=${encodeURIComponent(address)}&action=lbtc`;
    const res = await fetch(url);
    const { ok, status } = res;
    if (!ok) throw new Error(`faucet failed (${status}): ${address}`)
    const data = await res.json();
    // Extract the 64-char hex txid embedded in the result string.
    const txid = (data.result as string | undefined)?.match(/[0-9a-f]{64}/)?.[0] ?? null;
    return { ...data, txid };
  }
}
