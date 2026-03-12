import type { p2wpkh } from '@scure/btc-signer';
import type { Log, Num } from '../../library/index.ts';
import { Obj, sleep } from '../../library/index.ts';
import BtcRpc  from './BtcRpc.ts';
import BtcRest from './BtcRest.ts';
import Esplora from './Esplora.ts';
/** Merged export. */
export default Btc;
/** A Bitcoin or Elements connection. */
interface Btc extends Log {
  ID:           "mainnet"|"testnet"|"regtest"|"liquid1"|"liquidtestnet"|"elementsregtest",
  ASSETS:       Record<string, string>,
  P2WPKH:       (ecdsaPubkey: Uint8Array) => ReturnType<typeof p2wpkh>,
  broadcast:    (hex: string)     => Promise<string>,
  getBlockHash: (height: Num)     => Promise<string>,
  getTxInfo:    (txid: string)    => Promise<Btc.Tx>,
  getUtxo:      (address: string, finder?: Fn<[Btc.Utxo], boolean>) => Promise<Btc.Utxo>,
  getUtxos:     (address: string) => Promise<Btc.Utxo[]>,
  rescan:       () => Promise<void>,
  esplora?:     Esplora,
  rest?:        BtcRest,
  rpc?:         BtcRpc,
};
/** Connect to Bitcoin via RPC, REST, and/or Esplora. */
function Btc <T extends Btc> (options?: string|Btc.Options): T {
  // Support connecting from string (url)
  if (typeof options === 'string') options = { rpc: options, rest: options };
  // Maybe this is the way for contextual logging?
  const warn  = options.warn  || console.warn;
  const debug = options.debug || console.debug;
  // No partially mutable bindings in JS :(
  const { rpc, rest, esplora, ...context } = options || {};
  // Initialize the API callers that constitute the chain connection.
  const chain = {
    // Allow these methods to be overridden:
    broadcast, getUtxos, getUtxo, getBlockHash, rescan, getTxInfo, getBalance,
    // User-passed config:
    ...context,
    // Non-negotiable (FIXME move typeof checks in individual constructors, enabling passthru)
    esplora: (typeof esplora === 'string') ? Esplora({ url: esplora }) : esplora,
    rest:    (typeof rest    === 'string') ? BtcRest(rest)             : rest,
    rpc:     (typeof rpc     === 'string') ? BtcRpc(rpc)               : rpc,
  };
  // FIXME why does it need a typecast?
  return chain as unknown as T;

  async function getBlockHash (height: Num = 0) {
    if (chain.rpc) {
      return chain.rpc.getblockhash(height)
    } else if (chain.esplora) {
      return chain.esplora.getBlockHash(Number(height))
    } else {
      throw new Error('need { rpc } or { esplora } to find block hash');
    }
  }

  async function broadcast (hex: string) {
    if (chain.rpc) {
      return await chain.rpc.sendrawtransaction(hex);
    } else if (chain.esplora) {
      return await chain.esplora.postTx(hex);
    } else {
      throw new Error('need { rpc } or { esplora } to broadcast tx');
    }
  }

  async function rescan (...importAddress: string[]) {
    if (chain.rpc) {
      for (const address of importAddress) await chain.rpc.importaddress(address);
      await chain.rpc.rescanblockchain();
    } else {
      warn('rescan has no effect without { rpc }')
    }
  }

  async function getTxInfo (txid: string) {
    if (chain.rest) {
      return await chain.rest.tx(txid);
    } else if (chain.esplora) {
      while (true) {
        const mempool = await chain.esplora.getMempoolTxids().then(JSON.parse);
        if (mempool.includes(txid)) {
          debug('TX still in mempool:', txid);
          await sleep(1000);
        } else {
          return chain.esplora.getTxInfo(txid);
        }
      }
    } else {
      throw new Error('need { rest } or { esplora } to query tx info')
    }
  }

  async function getUtxos (
    address: string,
    minconf = 0,
    maxconf = 9999999,
  ): Promise<Btc.Utxo[]> {
    if (chain.rpc) {
      return await chain.rpc.listunspent(minconf, maxconf, [address]); // TODO filter
    } else if (chain.esplora) {
      return (await chain.esplora.getAddressUtxos(address)).map(utxo=>{
        const { txid, vout, value, asset } = utxo;
        return { asset, txid, vout, address, amount: BigInt(value) };
      });
    } else {
      throw new Error('need { rpc } or { esplora } to find unspent output');
    }
  }

  async function getUtxo (address: string, finder = (_: Btc.Utxo)=>true) {
    const utxos = await getUtxos(address);
    return Btc.Utxo(utxos.find(finder) || (()=>{throw new Error(`no UTXOs for ${address}`)})());
  }

  async function getBalance (address: string, minconf = 0) {
    if (chain.rpc) {
      await chain.rpc.importaddress(address);
      await chain.rpc.rescanblockchain();
      return await chain.rpc.getreceivedbyaddress(address, minconf);
    } else if (chain.esplora) {
      const balance = {};
      for (const utxo of await getUtxos(address, minconf)) {
        balance[utxo.asset] ??= 0n;
        balance[utxo.asset] += utxo.amount;
      }
      return balance;
    }
  }
}
/** Bitcoin internals. */
namespace Btc {
  /** Bitcoin connection options. */
  export interface Options extends Partial<Log> {
    rpc?:     string|BtcRpc,
    rest?:    string|BtcRest,
    esplora?: string|Esplora,
  };
  /** Connect to Bitcoin mainnet. */
  export function Mainnet (options?: Btc.Options) { return Obj(Btc(options), { ...Mainnet }); }
  /** Mainnet specifics. */
  export namespace Mainnet { export const ID = 'mainnet'; /* TODO */ }
  /** Connect to Bitcoin testnet. */
  export function Testnet (options?: Btc.Options) { return Obj(Btc(options), { ...Testnet }); }
  /** Testnet specifics. */
  export namespace Testnet { export const ID = 'testnet'; /* TODO */ }

  export interface Utxo {
    asset:   string,
    txid:    string,
    vout:    Num,
    amount:  Num,
    address: string,
  };

  export function Utxo (x: Btc.Utxo): Btc.Utxo & { amount: bigint } {
    return { ...x, amount: toSat(x.amount) }
  }

  export const toSat = (x: unknown): bigint => {
    if (typeof x === 'bigint') return x;
    if (typeof x === 'number') return BigInt(Math.round(x * 1e8));
    throw new Error(`expected BigInt(100000001)sat or Number(1.00000001)btc, got: ${x}`);
  };

  export interface Tx {
    txid: string,
    hex:  string,
    vin:  unknown[],
    vout: unknown[],
  }
}
