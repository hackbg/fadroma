import { Async, Fn, Pipe, Spawn, Temp } from '../index.ts';
import { ChildProcess } from '../deps.ts';
/** A Bitcoin or Elements daemon. */
export interface Btc extends Btc.Options {}
/** Launch with default settings and temporary datadir.
  * If callback is present, close after executing it. */
export function Btc <T> (
  callback?: Fn<[Btc], Async<T>>
): Promise<Async<T>>;
/** Launch with specified options.
  * If callback is present, close after executing it. */
export function Btc <T> (
  options:   string|Btc.Options,
  callback?: Fn<[Btc], Async<T>>
): Promise<Async<T>>;
/** Launch Bitcoin node. */
export async function Btc <T> (...args: unknown[]): Promise<Async<T>> {
  const options: Btc.Options =
    (typeof args[0] === 'string')   ? { datadir: args.shift() } :
    (typeof args[0] === 'function') ? { }                       : args.shift();
  if (typeof options !== 'object') throw new Error('invalid options');
  const spawn = Btc.spawn(options);
  const { rpcuser, rpcpassword, rpcallowip, rpcport } = options;
  const process = await spawn();
  try {
    const url = `http://${rpcuser}:${rpcpassword}@${rpcallowip}:${rpcport}`;
    Object.assign(process, { rest: Btc.rest(url), rpc: Btc.rpc(url) });
    return await Pipe(...args as Fn[])(process) as T;
  } finally {
    process.kill();
  }
}
/** Bitcoin internals. */
export namespace Btc {
  /** Bitcoin daemon options. */
  export type Options = Parameters<typeof spawn>[0];
  /** Launch an Elementsd localnet suitable
    * for testing SimplicityHL programs. */
  export function spawn ({
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
  } = {}) {
    return Spawn(daemon, ...[
      (server                  !== null) && (server ? '-server' : null),
      (chain                   !== null) && `-chain=${chain}`,
      (datadir                 !== null) && `-datadir=${datadir}`,
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
    ].filter(Boolean));
  }
  /** Bitcoin node's JSON-RPC API. */
  export const rpc = function btcRpc (url: string): {
    generatetoaddress: Fn,
    createwallet:      Fn,
    rescanblockchain:  Fn,
    getwalletinfo:     Fn,
    getnewaddress:     Fn,
    validateaddress:   Fn,
    sendtoaddress:     Fn,
  } {
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
  /** Bitcoin node's optional REST API. */
  export const rest = function btcRest (url: string): {
    chaininfo: Fn,
    getutxos:  Fn,
  } {
    return {
      async chaininfo () {
        return JSON.parse(await callUrl(`${url}/rest/chaininfo.json`))
      },
      async getutxos (...args: string[]) {
        return JSON.parse(await callUrl(`${url}/rest/getutxos/${args.join('/')}.json`))
      },
    }
  }
  /** Fetch helper. */
  async function callUrl (url: string|URL, method = 'GET', body?: BodyInit) {
    const result = await fetch(url, { method, body: JSON.stringify(body) });
    const text = await result.text();
    const code = result.status;
    if (code !== 200) {
      throw Object.assign(new Error(`${url}: ${code} (${text})`), { code, text })
    } else {
      return text;
    }
  }
}
