import { Async, Fn, Spawn, Temp, callUrl } from '../index.ts';
/** A Bitcoin or Elements daemon. */
export interface Btc {
  kill: () => void
  url:  string,
  rpc:  Btc.Rpc
  rest: Btc.Rest
}
/** Launch Bitcoin node. */
export async function Btc <T> ({
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
} = {}): Promise<Async<T>> {
  const bool = x => x ? '1' : '0';
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
  const spawn = Spawn(daemon, ...options.filter(Boolean));
  console.log([spawn.daemon, ...spawn.options].join(' '));
  const process = await spawn();
  const url = `http://${rpcuser}:${rpcpassword}@${rpcallowip}:${rpcport}`;
  return Object.assign(process, {
    url,
    rest: Btc.Rest(url),
    rpc:  Btc.Rpc(url)
  });
}

/** Bitcoin internals. */
export namespace Btc {

  /** Bitcoin daemon options. */
  export type Options = Parameters<typeof Btc>[0];

  export interface Rpc {
    createwallet:              Fn,
    decoderawtransaction:      Fn,
    decodescript:              Fn,
    generatetoaddress:         Fn,
    getnewaddress:             Fn,
    getwalletinfo:             Fn.Returns<Promise<{
      balance: Record<string, number>
    }>>,
    rescanblockchain:          Fn,
    sendtoaddress:             Fn,
    sendrawtransaction:        Fn,
    signrawtransactionwithkey: Fn,
    validateaddress:           Fn,
  }

  /** Bitcoin node's JSON-RPC API. */
  export const Rpc = function btcRpc (url: string): Rpc {
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
      getnewaddress:             callRpc('getnewaddress'),
      getwalletinfo:             callRpc('getwalletinfo'),
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
  export const Rest = function btcRest (url: string): Rest {
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

}
