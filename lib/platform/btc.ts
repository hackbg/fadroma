import { Async, Fn, Pipe, Spawn, Temp, callUrl } from '../index.ts';
import { ChildProcess } from '../deps.ts';
/** A Bitcoin or Elements daemon. */
export interface Btc {
  kill: () => void
  url:  string,
  rpc:  Btc.Rpc
  rest: Btc.Rest
}
/** Launch Bitcoin node. */
export async function Btc <T> ({
  daemon                  = 'elementsd'      as string,
  chain                   = 'regtest'        as string,
  datadir                 = Temp.make(chain) as string|Promise<string>,
  rpcuser                 = `fadroma`        as string,
  rpcpassword             = `fadroma`        as string,
  rpcport                 = '8941'           as string|number,
  rpcallowip              = '127.0.0.1'      as string,
  validatepegin           = null             as boolean,
  defaultpeggedassetname  = null             as string,
  initialfreecoins        = null             as string|number|bigint,
  initialreissuancetokens = null             as string|number|bigint,
  persistmempool          = null             as boolean,
  dnsseed                 = null             as boolean,
  server                  = null             as boolean,
  discover                = null             as boolean,
  txindex                 = null             as boolean,
  rest                    = null             as boolean,
  blindedprefix           = null             as number,
  bech32_hrp              = null             as string,
  blech32_hrp             = null             as string,
  pubkeyprefix            = null             as number,
  scriptprefix            = null             as number,
} = {}): Promise<Async<T>> {
  const options = [
    (server                  !== null) && (server ? '-server' : null),
    (chain                   !== null) && `-chain=${chain}`,
    (datadir                 !== null) && `-datadir=${await datadir}`,
    (defaultpeggedassetname  !== null) && `-defaultpeggedassetname=${defaultpeggedassetname}`,
    (rpcallowip              !== null) && `-rpcallowip=${rpcallowip}`,
    (rpcpassword             !== null) && `-rpcpassword=${rpcpassword}`,
    (rpcport                 !== null) && `-rpcport=${rpcport}`,
    (rpcuser                 !== null) && `-rpcuser=${rpcuser}`,
    (validatepegin           !== null) && `-validatepegin=${validatepegin}`,
    (initialfreecoins        !== null) && `-initialfreecoins=${initialfreecoins}`,
    (initialreissuancetokens !== null) && `-initialreissuancetokens=${initialreissuancetokens}`,
    (persistmempool          !== null) && `-persistmempool=${persistmempool ? '1':'0'}`,
    (dnsseed                 !== null) && `-dnsseed=${dnsseed ? '1':'0'}`,
    (rest                    !== null) && `-rest=${rest ? '1': '0'}`,
    (discover                !== null) && `-discover=${discover ? '1':'0'}`,
    (txindex                 !== null) && `-txindex=${txindex ? '1':'0'}`,
    (blindedprefix           !== null) && `-blindedprefix=${blindedprefix}`,
    (bech32_hrp              !== null) && `-bech32_hrp=${bech32_hrp}`,
    (blech32_hrp             !== null) && `-blech32_hrp=${blech32_hrp}`,
    (pubkeyprefix            !== null) && `-pubkeyprefix=${pubkeyprefix}`,
    (scriptprefix            !== null) && `-scriptprefix=${scriptprefix}`,
    //'-debug=rpc', //'-debug=zmq',
  ];
  const spawn = Spawn(daemon, ...options.filter(Boolean));
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
    generatetoaddress: Fn,
    createwallet:      Fn,
    rescanblockchain:  Fn,
    getwalletinfo:     Fn,
    getnewaddress:     Fn,
    validateaddress:   Fn,
    sendtoaddress:     Fn,
  }

  /** Bitcoin node's JSON-RPC API. */
  export const Rpc = function btcRpc (url: string): Rpc {
    const callRpc = (method: string) => async (...params: unknown[]) => {
      const body = { jsonrpc: "1.0", id: 1, method, params, };
      const text = await callUrl(url, 'POST', body);
      return JSON.parse(text).result
    };
    return {
      generatetoaddress: callRpc('generatetoaddress'),
      createwallet:      callRpc('createwallet'),
      rescanblockchain:  callRpc('rescanblockchain'),
      getwalletinfo:     callRpc('getwalletinfo'),
      getnewaddress:     callRpc('getnewaddress'),
      validateaddress:   callRpc('validateaddress'),
      sendtoaddress:     callRpc('sendtoaddress'),
    }
  }

  export interface Rest {
    chaininfo: Fn,
    block:     Fn,
    tx:        Fn,
  }

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
