import process from 'node:process';
import { Fn, Port, Run, Temp, Num, callUrl } from '../index.ts';
export default Btc;
/** A Bitcoin or Elements daemon. */
interface Btc extends Run.Daemon {
  url:      string,
  rpc:      Btc.Rpc
  rest:     Btc.Rest
  verbose?: boolean
}
/** Launch Bitcoin node. */
async function Btc <T> ({
  debug = console.debug,
  //log   = console.log,

  acceptnonstdtxn             = null             as boolean,
  anyonecanspendaremine       = null             as boolean,
  bech32_hrp                  = null             as string,
  blech32_hrp                 = null             as string,
  blindedaddresses            = null             as boolean,
  blindedprefix               = null             as number,
  con_blocksubsidy            = null             as number,
  con_elementsmode            = null             as boolean,
  con_connect_genesis_outputs = null             as boolean,
  chain                       = 'regtest'        as string,
  daemon                      = 'elementsd'      as string,
  datadir                     = Temp.make(chain) as string|Promise<string>,
  defaultpeggedassetname      = null             as string,
  discover                    = null             as boolean,
  dnsseed                     = null             as boolean,
  evbparams                   = null             as string,
  feeasset                    = null             as string,
  initialfreecoins            = null             as string|number|bigint,
  initialreissuancetokens     = null             as string|number|bigint,
  maxtxfee                    = null             as string|number|bigint,
  persistmempool              = null             as boolean,
  pubkeyprefix                = null             as number,
  rest                        = null             as boolean,
  rpcallowip                  = '127.0.0.1'      as string,
  rpcpassword                 = `fadroma`        as string,
  rpcport                     = '8941'           as string|number,
  rpcuser                     = `fadroma`        as string,
  scriptprefix                = null             as number,
  server                      = null             as boolean,
  subsidyasset                = null             as string,
  txindex                     = null             as boolean,
  validatepegin               = null             as boolean,
  vbparams                    = null             as string,
} = {}): Promise<Fn.Async<T>> {
  const bool = (x: unknown) => x ? '1' : '0';
  const options = [
    (acceptnonstdtxn             !== null) && `-acceptnonstdtxn=${bool(acceptnonstdtxn)}`,
    (anyonecanspendaremine       !== null) && `-anyonecanspendaremine=${bool(anyonecanspendaremine)}`,
    (bech32_hrp                  !== null) && `-bech32_hrp=${bech32_hrp}`,
    (blech32_hrp                 !== null) && `-blech32_hrp=${blech32_hrp}`,
    (blindedaddresses            !== null) && `-blindedaddresses=${bool(blindedprefix)}`,
    (blindedprefix               !== null) && `-blindedprefix=${blindedprefix}`,
    (chain                       !== null) && `-chain=${chain}`,
    (con_blocksubsidy            !== null) && `-con_blocksubsidy=${Number(con_blocksubsidy)||0}`,
    (con_elementsmode            !== null) && `-con_elementsmode=${bool(con_elementsmode)}`,
    (con_connect_genesis_outputs !== null) && `-con_connect_genesis_outputs=${con_connect_genesis_outputs?'1':'0'}`,
    (datadir                     !== null) && `-datadir=${await datadir}`,
    (defaultpeggedassetname      !== null) && `-defaultpeggedassetname=${defaultpeggedassetname}`,
    (discover                    !== null) && `-discover=${bool(discover)}`,
    (dnsseed                     !== null) && `-dnsseed=${bool(dnsseed)}`,
    (evbparams                   !== null) && `-evbparams=${evbparams}`,
    (feeasset                    !== null) && `-feeasset=${feeasset}`,
    (initialfreecoins            !== null) && `-initialfreecoins=${initialfreecoins}`,
    (initialreissuancetokens     !== null) && `-initialreissuancetokens=${initialreissuancetokens}`,
    (maxtxfee                    !== null) && `-maxtxfee=${maxtxfee}`,
    (persistmempool              !== null) && `-persistmempool=${bool(persistmempool)}`,
    (pubkeyprefix                !== null) && `-pubkeyprefix=${pubkeyprefix}`,
    (rest                        !== null) && `-rest=${bool(rest)}`,
    (rpcallowip                  !== null) && `-rpcallowip=${rpcallowip}`,
    (rpcpassword                 !== null) && `-rpcpassword=${rpcpassword}`,
    (rpcport                     !== null) && `-rpcport=${rpcport}`,
    (rpcuser                     !== null) && `-rpcuser=${rpcuser}`,
    (scriptprefix                !== null) && `-scriptprefix=${scriptprefix}`,
    (server                      !== null) && (server ? '-server' : null),
    (subsidyasset                !== null) && `-subsidyasset=${subsidyasset}`,
    (txindex                     !== null) && `-txindex=${bool(txindex)}`,
    (validatepegin               !== null) && `-validatepegin=${validatepegin}`,
    (vbparams                    !== null) && `-vbparams=${vbparams}`,
    //'-debug=rpc', //'-debug=zmq',
  ];
  const spawn = Run.Spawn(daemon, ...options.filter(Boolean));
  debug('Spawning:', [spawn.daemon, ...spawn.options].join(' '));
  const btc = await spawn();
  const url = `http://${rpcuser}:${rpcpassword}@${rpcallowip}:${rpcport}`;
  await Port.Wait({ port: rpcport })();
  return Object.assign(btc, {
    url,
    rest: Btc.Rest(url),
    rpc:  Btc.Rpc(url)
  });
}

/** Bitcoin internals. */
namespace Btc {

  /** Bitcoin daemon options. */
  export type Options = Parameters<typeof Btc>[0];

  export interface Rpc {
    createwallet:              Fn,
    decoderawtransaction:      Fn,
    decodescript:              Fn,
    generatetoaddress:         Fn,
    getaddressinfo:            Fn.Returns<Promise<{ pubkey: string }>>,
    getnewaddress:             Fn.Returns<Promise<string>>,
    getreceivedbyaddress:      Fn,
    getwalletinfo:             Fn.Returns<Promise<{ balance: Record<string, number> }>>,
    importaddress:             Fn.Takes<[string, string?, boolean?, boolean?]>,
    rescanblockchain:          Fn.Takes<[Num?, Num?]>,
    sendtoaddress:             Fn,
    sendrawtransaction:        Fn,
    signrawtransactionwithkey: Fn,
    validateaddress:           Fn,
  }

  /** Bitcoin node's JSON-RPC API. */
  export function Rpc (url: string): Rpc {
    const callRpc = (method: string) => async (...params: unknown[]) => {
      const body = { jsonrpc: "1.0", id: 1, method, params, };
      const text = await callUrl(url, 'POST', body);
      return JSON.parse(text).result
    };
    return {
      createwallet:              callRpc('createwallet'),
      decoderawtransaction:      callRpc('decoderawtransaction'),
      decodescript:              callRpc('decodescript'),
      generatetoaddress:         callRpc('generatetoaddress'),
      getaddressinfo:            callRpc('getaddressinfo'),
      getnewaddress:             callRpc('getnewaddress'),
      getreceivedbyaddress:      callRpc('getreceivedbyaddress'),
      getwalletinfo:             callRpc('getwalletinfo'),
      importaddress:             callRpc('importaddress'),
      rescanblockchain:          callRpc('rescanblockchain'),
      sendtoaddress:             callRpc('sendtoaddress'),
      sendrawtransaction:        callRpc('sendrawtransaction'),
      signrawtransactionwithkey: callRpc('signrawtransactionwithkey'),
      validateaddress:           callRpc('validateaddress'),
    }
  }

  export interface Rest {
    chaininfo: Fn,
    block:     Fn,
    tx:        Fn.Returns<Promise<{
      hex:       string,
      txid:      string,
      blockhash: string,
      vout:      Vout[]
    }>>,
  }

  export interface Vout {
    value: number,
    scriptPubKey: {
      type:    string,
      address: string
    }
  };

  /** Bitcoin node's optional REST API. */
  export function Rest (url: string): Rest {
    return {
      async chaininfo (format = "json") {
        let data = await callUrl(`${url}/rest/chaininfo.${format}`);
        if (format === 'json') data = JSON.parse(data);
        return data;
      },
      async block (hash, format = "json") {
        let data = await callUrl(`${url}/rest/block/${hash}.${format}`);
        if (format === 'json') data = JSON.parse(data);
        return data;
      },
      async tx (hash, format = "json") {
        let data = await callUrl(`${url}/rest/tx/${hash}.${format}`);
        if (format === 'json') data = JSON.parse(data);
        return data;
      },
    }
  }

  /** Define test wallet. */
  export function CreateWallet (name: string, cb?: Fn) {
    return Fn.Name(`Create test wallet ${name}`, async (context: Btc) => {
      await context.rpc.createwallet(name);
      cb && await cb(await context.rpc.getwalletinfo());
      return context
    })
  };

  /** Define rescan. */
  export function Rescan (cb?: Fn) {
    return Fn.Name(`Rescan`, async (context: Btc) => {
      await context.rpc.rescanblockchain();
      await cb(await context.rpc.getwalletinfo());
      return context
    })
  };

  /** Define daemon verbosity. */
  export function Verbose (
    enabled?: boolean, stdout = process.stderr, stderr = process.stderr
  ) {
    return Fn.Name(`Verbose: ${enabled}`, (context: Btc) => {
      context.verbose = enabled;
      if (enabled) {
        context.stdout.pipe(stdout);
        context.stderr.pipe(stderr);
      }
      return context
    })
  };

  /** Spawn Elements in `elementsregtest` mode with Simplicity enabled. */
  export function ElementsRegtest (options?: Options) {
    return Btc({
      chain:                       'elementsregtest',
      acceptnonstdtxn:             true,
      anyonecanspendaremine:       true,
      bech32_hrp:                  'tex',
      blech32_hrp:                 'tlq',
      blindedprefix:               23,
      blindedaddresses:            true,
      con_blocksubsidy:            0,
      con_connect_genesis_outputs: true,
      con_elementsmode:            true,
      defaultpeggedassetname:      'bitcoin',
      discover:                    false,
      dnsseed:                     false,
      evbparams:                   'simplicity:-1:::',
      initialfreecoins:            ElementsRegtest.INITIAL.COINS,
      initialreissuancetokens:     ElementsRegtest.INITIAL.REISSUE,
      maxtxfee:                    100.0,
      persistmempool:              false,
      pubkeyprefix:                36,
      rest:                        true,
      rpcallowip:                  '127.0.0.1',
      rpcpassword:                 'fadroma',
      rpcport:                     8941,
      rpcuser:                     'fadroma',
      scriptprefix:                13,
      server:                      true,
      txindex:                     true,
      validatepegin:               false,
      vbparams:                    "taproot:1:1",
      //feeasset:                    BITCOIN,
      //subsidyasset:                BITCOIN,
      ...options,
    })
  }
  export namespace ElementsRegtest {
    /** 1 BTC = 100000000 Satoshis. */
    export const DECIMAL = 100000000n;
    /** Default values for `initialfreecoins` and `initialreissuancetokens`. */
    export const INITIAL = { COINS: 1000000n * DECIMAL, REISSUE: 1n * DECIMAL };
    /** Asset ID for default initial reissuance token. */
    export const REISSUE = 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61';
    /** Asset ID for regular old Bitcoin. */
    export const BITCOIN = 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23';
    ///** Asset IDs of (t)L-BTC. */
    //const LIQUID  = { mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d'
    //               , testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49' };
  }
}
