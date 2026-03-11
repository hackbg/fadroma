import type Btc from './Btc.ts';
import { Num, Fn, Http } from '../../library/index.ts';

export default BtcRpc;

interface BtcRpc {
  createwallet:                 Fn,
  createpsbt:                   Fn,
  decoderawtransaction:         Fn,
  decodescript:                 Fn,
  generatetoaddress:            Fn,
  getaddressinfo:               Fn.Returns<Promise<{ pubkey: string }>>,
  getbestblockhash:             Fn.Returns<Promise<string>>,
  getblockhash:                 Fn<[Num], Promise<string>>,
  getnewaddress:                Fn.Returns<Promise<string>>,
  getreceivedbyaddress:         Fn,
  getwalletinfo:                Fn.Returns<Promise<{ balance: Record<string, number> }>>,
  importaddress:                Fn.Takes<[string, string?, boolean?, boolean?]>,
  listunspent:                  Fn,
  loadwallet:                   Fn,
  rescanblockchain:             Fn.Takes<[Num?, Num?]>,
  sendtoaddress:                Fn,
  sendrawtransaction:           Fn,
  signrawtransactionwithkey:    Fn,
  signrawtransactionwithwallet: Fn<[string]>,
  validateaddress:              Fn.Takes<[string]>,
}

/** Bitcoin node's JSON-RPC API. */
function BtcRpc (url, {
  // Takes name of method, returns function that calls it.
  call = (method: keyof BtcRpc) => {
    // This gives the dynamically generated function it a nice name, for stack traces and stuff.
    return Fn.Name(`call ${method} on ${url}`, callRpc) as BtcRpc[typeof method];
    // This sends a JSON-RPC v1.0 POST with constant ID=1 to the JSON-RPC endpoint.
    function callRpc (...args: unknown[]) {
      return Http.postJsonRpcV1_0(url, 1, method, ...args);
    }
  }
} = {}): BtcRpc {
  if (!url) throw new Error("Can't create Bitcoin RPC client without { url }");
  return {
    createwallet:                 call('createwallet'),
    createpsbt:                   call('createpsbt'),
    decoderawtransaction:         call('decoderawtransaction'),
    decodescript:                 call('decodescript'),
    generatetoaddress:            call('generatetoaddress'),
    getaddressinfo:               call('getaddressinfo'),
    getbestblockhash:             call('getbestblockhash'),
    getblockhash:                 call('getblockhash'),
    getnewaddress:                call('getnewaddress'),
    getreceivedbyaddress:         call('getreceivedbyaddress'),
    getwalletinfo:                call('getwalletinfo'),
    importaddress:                call('importaddress'),
    listunspent:                  call('listunspent'),
    loadwallet:                   call('loadwallet'),
    rescanblockchain:             call('rescanblockchain'),
    sendtoaddress:                call('sendtoaddress'),
    sendrawtransaction:           call('sendrawtransaction'),
    signrawtransactionwithkey:    call('signrawtransactionwithkey'),
    signrawtransactionwithwallet: call('signrawtransactionwithwallet'),
    validateaddress:              call('validateaddress'),
  } as const;
}

namespace BtcRpc {
  /** Define test wallet. */
  export function CreateWallet (name: string, cb?: Fn) {
    return Fn.Name(`Create wallet ${name}`, async (context: { rpc: BtcRpc }) => {
      await context.rpc.createwallet(name);
      if (cb) await cb(await context.rpc.getwalletinfo());
      return context
    })
  };
  /** Define rescan. */
  export function Rescan (cb?: Fn) {
    return Fn.Name(`Rescan`, async (context: { rpc: BtcRpc }) => {
      await context.rpc.rescanblockchain();
      if (cb) await cb(await context.rpc.getwalletinfo());
      return context
    })
  };
  /** Send funds using RPC from loaded wallet to address.
    * If no `to` addres is provided, a random one is generated.
    * If a number from 1 to 255 is passed as address, a non-secret testing key is used. */
  export function SendFromWallet (amount: string|number|bigint, to: string) {
    const id = (typeof to === 'number')?`NPK#${to}`:to;
    return Fn.Name(`Wallet sends ${amount} to ${id}`, async (context: Btc & {
      txid?: string, tx?: Btc.Tx
    }) => {
      context.txid = await context.rpc.sendtoaddress(to, String(100000)) as string;
      context.tx = await context.rest.tx(context.txid) as Btc.Tx;
      await context.rpc.importaddress(to);
      await context.rpc.rescanblockchain();
    });
  }
}
