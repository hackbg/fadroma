import type { pubECDSA } from 'npm:@scure/btc-signer/utils.js';
import { p2wpkh } from 'npm:@scure/btc-signer';
import { Num, Fn, Obj, Run, Spawn, Log, Port, Temp, Http } from '../../library/index.ts';
/** 1 BTC = 100000000sat. https://bitcoin.org/bitcoin.pdf */
export const BITCOIN = 100000000n;
/** Merged export. */
export default Btc;
/** A Bitcoin or Elements daemon. */
type Btc = Run & { verbose?: boolean, url?: string, rest?: BtcRest, rpc?: BtcRpc };
/** Launch Bitcoin node. */
async function Btc <T> (options: Btc.Options = {}): Promise<Fn.Async<T>> {
  const { daemon = 'elementsd', debug = console.debug } = options;
  const { url, rpcport, args } = await Btc.Flags(options);
  const spawn = Spawn(daemon, ...args.filter(Boolean));
  debug('Spawning:', [spawn.daemon, ...spawn.options].join(' '));
  const btc = await spawn();
  await Port.Wait({ port: rpcport })();
  return Obj(btc, {
    url,
    rpc:     url && BtcRpc(options.rpcUrl || url),
    rest:    url && BtcRest(options.restUrl || url),
    esplora: url && Esplora({ url: options.esplora }),
  });
}
/** Bitcoin internals. */
namespace Btc {
  export type Options = Partial<Log> & Flags & {
    rpc?:     boolean|string|BtcRpc,
    rest?:    boolean|string|BtcRest,
    esplora?: boolean|string|Esplora,
  };
  /** Connect to Bitcoin mainnet. */
  export function Mainnet (options?: Options) { return Obj(Btc(options), Mainnet); }
  /** Mainnet specifics. */
  export namespace Mainnet {}
  /** Connect to Bitcoin testnet. */
  export function Testnet (options?: Options) { return Obj(Btc(options), Testnet); }
  /** Testnet specifics. */
  export namespace Testnet {}
  /** Bitcoin daemon options. */
  export type Flags = Parameters<typeof Flags>[0];
  /** Parse [Flags] to list of command-line arguments: */
  export async function Flags ({
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

  export interface Vout {
    value: number,
    scriptPubKey: {
      type:    string,
      address: string
    }
  };
  // Helper for boolean arguments
  const bool = (x: unknown) => x ? '1' : '0';
  // Helper for temporary directories
  const temp = (chain: string) => Temp.make(`${chain}-${+new Date()}`)
}

/** Connect to Liquid mainnet. */
export function Liquid1 (options = { esplora: Liquid1.ESPLORA_URL }) {
  options.esplora ??= Liquid1.ESPLORA_URL;
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
  export const ASSET_LBTC   = '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';
  // ... TODO ...
}

/** Connect to Liquid testnet. */
export function LiquidTestnet (options = { esplora: LiquidTestnet.ESPLORA_URL }) {
  options.esplora ??= LiquidTestnet.ESPLORA_URL;
  return Obj(Btc(options), LiquidTestnet);
}
export namespace LiquidTestnet {
  export const ID           = 'liquidtestnet';
  export const GENESIS      = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1'; // TODO autofetch from block 0
  export const RPC_URL      = null;
  export const REST_URL     = null;
  export const ESPLORA_URL  = 'https://blockstream.info/liquidtestnet/api';
  export const NETWORK      = { bech32: 'tex', blech32: 'tlq', pubKeyHash: 36, scriptHash: 19, wif: 0xef };
  export const P2WPKH       = (x: ReturnType<typeof pubECDSA>) => p2wpkh(x, NETWORK);
  export const FAUCET_URL   = 'https://liquidtestnet.com/faucet';
  export const HRP_BECH32   = 'tex';
  export const HRP_BLECH32  = 'tlq';
  export const PREFIX_P2PKH = 36;
  export const PREFIX_P2SH  = 19;
  export const PREFIX_BLIND = 23;
  export const ASSETS = {
    DEFAULT: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
    LBTC:    '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
    TEST:    '38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5',
    AMP:     'bea126b86ac7f7b6fc4709d1bb1a8482514a68d35633a5580d50b18504d5c322',
  };
  export const RETURN_ADDRS = {
    RETURN_TEST: 'tlq1qq2g07nju42l0nlx0erqa3wsel2l8prnq96rlnhml262mcj7pe8w6ndvvyg237japt83z24m8gu4v3yfhaqvrqxydadc9scsmw',
    RETURN_AMP:  'vjU8JWGnZu6XavzMEbLZ3mGZ3nrPxpwoBNC3brPi7CFm12sb7bHSkB4gz4SGSV9LhBceZVGaF8nsevu6',
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

/** Spawn Elements in `elementsregtest` mode with Simplicity enabled. */
export async function ElementsRegtest (options?: Btc.Options) {
  return Obj(Btc({
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
  export const ID              = 'elementsregtest';
  export const HRP_BECH32      = 'ert';
  export const HRP_BLECH32     = 'el';
  export const NETWORK         = { bech32: HRP_BECH32, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, };
  export const P2WPKH          = (x: ReturnType<typeof pubECDSA>) => p2wpkh(x, NETWORK);
  export const PREFIX_P2PKH    = 235;
  export const PREFIX_P2SH     = 75;
  export const PREFIX_BLIND    = 4;
  export const PREFIX_PUBKEY   = 36;
  export const PREFIX_SCRIPT   = 13;
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

/** Client for Esplora REST API methods. */
export interface Esplora {
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
export function Esplora ({ url }: { url: string|URL }): Esplora {
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
export namespace Esplora {
  /** Transaction fetched from Esplora. */
  export interface Transaction {
    txid:   string;
    fee:    number;
    status: { confirmed: boolean; block_height?: number; block_time?: number };
    vout:   { value: number; scriptpubkey_address?: string }[];
  }
  /** Unspent transaction output fetched from Esplora. */
  export interface Utxo {
    txid:   string
    vout:   number
    asset:  string
    value:  number
    status: {
      block_hash:   string
      block_height: number
      block_time:   number
      confirmed:    boolean
    }
  }
}

export interface BtcRpc {
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
export function BtcRpc (url: string): BtcRpc {
  const callRpc = (method: string) => async (...params: unknown[]) => {
    const body = { jsonrpc: "1.0", id: 1, method, params, };
    const text = await Http.fetchText(url, 'POST', body);
    return JSON.parse(text).result
  };
  return {
    createwallet:                 callRpc('createwallet'),
    createpsbt:                   callRpc('createpsbt'),
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
    listunspent:                  callRpc('listunspent'),
    loadwallet:                   callRpc('loadwallet'),
    rescanblockchain:             callRpc('rescanblockchain'),
    sendtoaddress:                callRpc('sendtoaddress'),
    sendrawtransaction:           callRpc('sendrawtransaction'),
    signrawtransactionwithkey:    callRpc('signrawtransactionwithkey'),
    signrawtransactionwithwallet: callRpc('signrawtransactionwithwallet'),
    validateaddress:              callRpc('validateaddress'),
  }
}
export namespace BtcRpc {
  /** Define test wallet. */
  export function CreateWallet (name: string, cb?: Fn) {
    return Fn.Name(`Create wallet ${name}`, async (context: Btc) => {
      await context.rpc.createwallet(name);
      return withWalletInfo(context, cb);
    })
  };
  /** Define rescan. */
  export function Rescan (cb?: Fn) {
    return Fn.Name(`Rescan`, async (context: Btc) => {
      await context.rpc.rescanblockchain();
      return withWalletInfo(context, cb);
    })
  };
  /** Fetch wallet info and run a callback on it. */
  async function withWalletInfo (context: Btc, cb?: Fn) {
    if (cb) await cb(await context.rpc.getwalletinfo());
    return context
  }
}

export interface BtcRest {
  chaininfo: Fn,
  block:     Fn,
  tx:        Fn<[string, "json"?], Promise<{
    hex:       string,
    txid:      string,
    blockhash: string,
    vout:      Btc.Vout[]
  }>>,
}

/** Bitcoin node's optional REST API. */
export function BtcRest (url: string): Rest {
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
    async tx (hash: string, format = "json" as const) {
      let data = await Http.fetchText(`${url}/rest/tx/${hash}.${format}`);
      if (format === 'json') data = JSON.parse(data);
      return data;
    },
  }
}
