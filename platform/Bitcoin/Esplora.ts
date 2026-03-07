import { Num, Fn, Http } from '../../library/index.ts';

export default Esplora;

/** Client for Esplora REST API methods. */
interface Esplora {
  url: string|URL,

  getBlockTipHeight: Fn.Returns<Fn.Async<Num>>,
  getBlockTipHash:   Fn
  getTxInfo:         Fn
  getTxHex:          Fn
  getAddressInfo:    Fn
  getAddressTxs:     (address: string) => Promise<Array<Esplora.Transaction>>
  getAddressUtxos:   (address: string) => Promise<Array<Esplora.Utxo>>
  postTx:            Fn
}

/** Construct a handle to Esplora REST API. */
function Esplora ({ url }: { url: string|URL }): Esplora {
  return {
    url,

    getBlockTipHeight: () => Http.fetchText(`${url}/blocks/tip/height`),
    getBlockTipHash:   () => Http.fetchText(`${url}/blocks/tip/hash`),
    getAddressInfo:    (ad: string) => Http.fetchJson(`${url}/address/${encodeURIComponent(ad)}`),
    getAddressUtxos:   (ad: string) => Http.fetchJson(`${url}/address/${encodeURIComponent(ad)}/utxo`),
    getAddressTxs:     (ad: string) => Http.fetchJson(`${url}/address/${encodeURIComponent(ad)}/txs`),
    getTxInfo:         (id: string) => Http.fetchJson(`${url}/tx/${encodeURIComponent(id)}`),
    getTxHex:          (id: string) => Http.fetchText(`${url}/tx/${encodeURIComponent(id)}/hex`),
    postTx:            (tx: string) => Http.postBinary(`${url}/tx`, tx),
  }
}

namespace Esplora {
  /** Transaction fetched from Esplora. */
  export interface Transaction {
    txid:            string;
    version:         number;
    locktime:        number;
    fee:             number;
    size:            number;
    weight:          number;
    discount_vsize:  number;
    discount_weight: number;
    vout:            Vout[];
    status: {
      confirmed:     boolean;
      block_height?: number;
      block_time?:   number;
    };
  }
  export interface Vin {
    txid:          string;
    vout:          number;
    prevout:       Vout;
    scriptsig:     string;
    scriptsig_asm: string;
    witness:       string[];
    is_coinbase:   boolean;
    sequence:      number;
    is_pegin:      boolean;
  }
  export interface Vout {
    value:                number;
    scriptpubkey:         string;
    scriptpubkey_asm:     string;
    scriptpubkey_type:    string;
    scriptpubkey_address: string;
    valuecommitment:      string;
    assetcommitment:      string;
  }
  /** Unspent transaction output fetched from Esplora. */
  export interface Utxo {
    txid:   string;
    vout:   number;
    asset:  string;
    value:  number;
    status: {
      block_hash:   string;
      block_height: number;
      block_time:   number;
      confirmed:    boolean;
    }
  }
}
