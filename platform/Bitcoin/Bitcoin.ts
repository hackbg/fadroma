import Fn from '../../library/Fn.ts';
import Run from '../../library/Run.ts';
import Http from '../../library/Http.ts';
import { Log } from '../../library/Log.ts';
import { Port } from '../../library/Port.ts';
import { Temp } from '../../library/Fs.ts';
import { Num, Base16 } from '../../library/Number.ts';
import process from 'node:process';
export default Bitcoin;
/** A Bitcoin or Elements daemon. */
type Bitcoin = Run.Daemon & Bitcoin.Connect & { verbose?: boolean };
/** Launch Bitcoin node. */
async function Bitcoin <T> (options: Partial<Log & Bitcoin.Options> = {}): Promise<Fn.Async<T>> {
  const { daemon = 'elementsd', debug = console.debug } = options;
  const { url, rpcport, args } = await Bitcoin.Options(options);
  const spawn = Run.Spawn(daemon, ...args.filter(Boolean));
  debug('Spawning:', [spawn.daemon, ...spawn.options].join(' '));
  const btc = await spawn();
  await Port.Wait({ port: rpcport })();
  return Object.assign(btc, Bitcoin.Connect(url));
}
/** Bitcoin internals. */
namespace Bitcoin {
  /** Bitcoin daemon options. */
  export type Options = Parameters<typeof Options>[0];
  /** Parse [Options] to list of command-line arguments: */
  export async function Options ({
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
    datadir                     = temp(chain)      as string|Promise<string>,
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
  } = {}) {
    const url = `http://${rpcuser}:${rpcpassword}@${rpcallowip}:${rpcport}`;
    const args = [
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
    return { url, rpcport, args }
  }

  // Helper for boolean arguments
  const bool = (x: unknown) => x ? '1' : '0';

  // Helper for temporary directories
  const temp = (chain: string) => Temp.make(`${chain}-${+new Date()}`)

  /** Connection to Bitcoin RPC and REST. */
  export interface Connect { url: string, rest: Rest, rpc: Rpc }

  /** Connect to Bitcoin RPC and REST at given URL. */
  export function Connect (url: string): Connect {
    return { url, rest: Bitcoin.Rest(url), rpc: Bitcoin.Rpc(url) }
  }

  /** 1 BTC = 100000000 Satoshis. */
  export const DECIMAL = 100000000n;

  /** Connect to Bitcoin mainnet. */
  export function Mainnet (options?: Options) {/* TODO */}
  export namespace Mainnet {/* TODO */}

  /** Connect to Bitcoin testnet. */
  export function Testnet (options?: Options) {/* TODO */}
  export namespace Testnet {/* TODO */}

  /** Connect to Liquid mainnet. */
  export function Liquid1 (options?: Options) {/* TODO */}
  export namespace Liquid1 {
    export const ID           = 'liquid1';
    export const HRP_BECH32   = 'ex';
    export const HRP_BLECH32  = 'lq';
    export const PREFIX_P2PKH = 57;
    export const PREFIX_P2SH  = 39;
    export const PREFIX_BLIND = 12;
    export const ASSET_LBTC   = '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';
    // ... TODO ...
  }

  /** Connect to Liquid testnet. */
  export function LiquidTestnet (options?: Options) {
    return Object.assign(Connect('https://liquidtestnet.com:18891'), LiquidTestnet);
  }
  export namespace LiquidTestnet {
    export const ID           = 'liquidtestnet';
    export const HRP_BECH32   = 'tex';
    export const HRP_BLECH32  = 'tlq';
    export const PREFIX_P2PKH = 36;
    export const PREFIX_P2SH  = 19;
    export const PREFIX_BLIND = 23;
    export const ASSET_LBTC   = '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49';
    export const ASSET_TEST   = '38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5';
    export const ASSET_AMP    = 'bea126b86ac7f7b6fc4709d1bb1a8482514a68d35633a5580d50b18504d5c322';
    export const FAUCET_URL   = 'https://liquidtestnet.com/faucet';
    export const RETURN_TEST  = 'tlq1qq2g07nju42l0nlx0erqa3wsel2l8prnq96rlnhml262mcj7pe8w6ndvvyg237japt83z24m8gu4v3yfhaqvrqxydadc9scsmw';
    export const RETURN_AMP   = 'vjU8JWGnZu6XavzMEbLZ3mGZ3nrPxpwoBNC3brPi7CFm12sb7bHSkB4gz4SGSV9LhBceZVGaF8nsevu6';
    export const GENESIS      = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1'; // TODO autofetch from block 0
    export const esplora      = Esplora('https://blockstream.info/liquidtestnet/api');
  }

  /** Spawn Elements in `elementsregtest` mode with Simplicity enabled. */
  export function ElementsRegtest (options?: Options) {
    return Bitcoin({
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
    })
  }
  export namespace ElementsRegtest {
    export const ID              = 'elementsregtest';
    export const HRP_BECH32      = 'ert';
    export const HRP_BLECH32     = 'el';
    export const PREFIX_P2PKH    = 235;
    export const PREFIX_P2SH     = 75;
    export const PREFIX_BLIND    = 4;
    export const PREFIX_PUBKEY   = 36;
    export const PREFIX_SCRIPT   = 13;
    export const INITIAL_COINS   = 1000000n * DECIMAL;
    export const INITIAL_REISSUE = 1n * DECIMAL;
    /** Asset ID for default initial reissuance token. */
    export const REISSUE = 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61';
    /** Asset ID for Bitcoin. */
    export const BITCOIN = 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23';
  }

  export interface Rpc {
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
    rescanblockchain:             Fn.Takes<[Num?, Num?]>,
    sendtoaddress:                Fn,
    sendrawtransaction:           Fn,
    signrawtransactionwithkey:    Fn,
    signrawtransactionwithwallet: Fn<[string], Signed>,
    validateaddress:              Fn.Takes<[string]>,
  }

  /** Bitcoin node's JSON-RPC API. */
  export function Rpc (url: string): Rpc {
    const callRpc = (method: string) => async (...params: unknown[]) => {
      const body = { jsonrpc: "1.0", id: 1, method, params, };
      const text = await Http.fetchText(url, 'POST', body);
      return JSON.parse(text).result
    };
    return {
      createwallet:                 callRpc('createwallet'),
      decoderawtransaction:         callRpc('decoderawtransaction'),
      decodescript:                 callRpc('decodescript'),
      generatetoaddress:            callRpc('generatetoaddress'),
      getaddressinfo:               callRpc('getaddressinfo'),
      getbestblockhash:             callRpc('getbestblockhash'),
      getblockhash:                 callRpc('getblockhash'),
      getnewaddress:                callRpc('getnewaddress'),
      getreceivedbyaddress:         callRpc('getreceivedbyaddress'),
      getwalletinfo:                callRpc('getwalletinfo'),
      importaddress:                callRpc('importaddress'),
      rescanblockchain:             callRpc('rescanblockchain'),
      sendtoaddress:                callRpc('sendtoaddress'),
      sendrawtransaction:           callRpc('sendrawtransaction'),
      signrawtransactionwithkey:    callRpc('signrawtransactionwithkey'),
      signrawtransactionwithwallet: callRpc('signrawtransactionwithwallet'),
      validateaddress:              callRpc('validateaddress'),
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
        let data = await Http.fetchText(`${url}/rest/chaininfo.${format}`);
        if (format === 'json') data = JSON.parse(data);
        return data;
      },
      async block (hash, format = "json") {
        let data = await Http.fetchText(`${url}/rest/block/${hash}.${format}`);
        if (format === 'json') data = JSON.parse(data);
        return data;
      },
      async tx (hash, format = "json") {
        let data = await Http.fetchText(`${url}/rest/tx/${hash}.${format}`);
        if (format === 'json') data = JSON.parse(data);
        return data;
      },
    }
  }

  /** Define test wallet. */
  export function CreateWallet (name: string, cb?: Fn) {
    return Fn.Name(`Create test wallet ${name}`, async (context: Bitcoin) => {
      await context.rpc.createwallet(name);
      cb && await cb(await context.rpc.getwalletinfo());
      return context
    })
  };

  /** Define rescan. */
  export function Rescan (cb?: Fn) {
    return Fn.Name(`Rescan`, async (context: Bitcoin) => {
      await context.rpc.rescanblockchain();
      await cb(await context.rpc.getwalletinfo());
      return context
    })
  };

  /** Define daemon verbosity. */
  export function Verbose (
    enabled?: boolean, stdout = process.stderr, stderr = process.stderr
  ) {
    return Fn.Name(`Verbose: ${enabled}`, (context: Bitcoin) => {
      context.verbose = enabled;
      if (enabled) {
        context.stdout.pipe(stdout);
        context.stderr.pipe(stderr);
      }
      return context
    })
  };

  /** The [Sign]er is an optionally-[Async]hronous function
    * that takes bytes and returns signed hex + complete flag + errors. */
  export interface Sign extends Fn<[Uint8Array], Fn.Async<Sign.Result>> {}

  /** Signer internals. */
  export namespace Sign {
    /** Sign with RPC to wallet node. */
    export function Rpc (rpc: Bitcoin.Rpc) {
      return async function signWithRpc (hex: Uint8Array): Promise<Bitcoin.Signed> {
        return await rpc.signrawtransactionwithwallet(Base16.encode(hex));
      }
    }
    /** Sign with keypair. */
    export function Key (secret: Uint8Array) {
      throw new Error('TODO')
    }
    /** Result of signing. */
    export interface Result {
      hex:      string,
      complete: boolean,
      errors?:  Error[]
    }
    /** RPC signing error. */
    export interface Error {
      txid:      string,
      vout:      number,
      witness:   string[],
      scriptSig: string,
      sequencer: number,
      error:     string
    }
  }

  export function Send ({ rpc, rest }: Pick<Bitcoin, 'rpc'|'rest'>) {
    return async function sendWithRpcAndRest (hex: Uint8Array) {
      const txid = await rpc.sendrawtransaction(hex);
      return await rest.tx(txid);
    }
  }

  export interface Esplora {
    getBlockTipHeight: Fn.Returns<Fn.Async<Num>>,
    getBlockTipHash:   Fn
    getTxInfo:         Fn
    getAddressInfo:    Fn
    getAddressUtxos:   (address: string) => Promise<Array<{ txid, asset, value }>>
    postTx:            Fn
  }

  export function Esplora (url: string|URL): Esplora {
    return {
      getBlockTipHeight: () => Http.fetchText(`${url}/blocks/tip/height`),
      getBlockTipHash:   () => Http.fetchText(`${url}/blocks/tip/hash`),
      getAddressInfo:  (ad) => Http.fetchJson(`${url}/address/${ad}`),
      getAddressUtxos: (ad) => Http.fetchJson(`${url}/address/${ad}/utxo`),
      getTxInfo:       (id) => Http.fetchJson(`${url}/tx/${id}`),
      postTx:          (tx) => Http.postBinary(`${url}/tx`, tx),
    }
  }

}
