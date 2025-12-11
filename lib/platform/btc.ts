import { Sub } from './btc/zeromq.ts';
import { Async, Fn, Pipe, Exec, Spawn, Temp, Service, Dir, Port, joined, merged } from '../index.ts';
import type { ChildProcess } from '../deps.ts';

export interface Btc {
  cli:       string,
  node:      string,
  regTest:   boolean,
  dataRoot:  string,
  dataDir:   string,
  walletDir: string,
  httpPort:  number,
  zmqPort:   number,
  rpcPort:   number,
  rpcUser:   string,
  rpcPass:   string,
  rpcQueue:  number,
  txIndex:   boolean,
  /** Spawn Bitcoin daemon. */
  spawnNode: (..._: string[]) => Spawn,
  /** Call Bitcoin CLI. */
  execCli:   (..._: string[]) => Exec,
  /** Call Bitcoin RPC. */
  rpc:       Fn,
  /** Subscribe to Bitcoin note via ZeroMQ. */
  subscribe: Fn<[Fn]>,
  /** Run Bitcoin localnet. */
  localnet:  Service,
};

export function Btc (...options: Partial<Btc>[]): Btc {
  const {
    cli       = 'bitcoin-cli',
    node      = 'bitcoind', // elementsd
    regTest   = true,
    rpcPort   = regTest ? 18443 : 8443,
    rpcUser   = 'fadroma',
    rpcPass   = 'fadroma',
    rpcQueue  = 32,
    dataRoot  = '/tmp/fadroma/test/btc/',
    dataDir   = joined('', dataRoot, 'data',   +new Date()),
    walletDir = joined('', dataRoot, 'wallet', +new Date()),
    zmqPort   = 48485,
    txIndex   = false,
    ...rest
  } = merged(...options);
  const localnet = Service('BTC Daemon',
    spawnNode,
    Dir(walletDir,
      execCli('createwallet', walletDir),
      execCli(`-rpcwallet=${walletDir}`, '-generate')));
  const context = { node, spawnNode, cli, execCli,
    regTest, rpcPort, rpcUser, rpcPass, rpcQueue,
    dataRoot, dataDir, walletDir, zmqPort, txIndex,
    localnet, subscribe, ...rest };
  function spawnNode (...args: string[]) {
    return Service(`Spawn(${node})`, Port(rpcPort, Dir(dataDir,
      Spawn(node, '-server',
        rpcPort && ('-rpcport=' + rpcPort),
        rpcUser && `-rpcuser=fadroma`,
        rpcPass && `-rpcpassword=${rpcPass}`,
        dataDir && `-datadir=${dataDir}`,
        regTest && '-regtest',
        txIndex && '-txindex',
        zmqPort && ('-zmqpubhashblock=tcp:/' + '/127.0.0.1:' + zmqPort),
        zmqPort && ('-zmqpubhashtx=tcp:/'    + '/127.0.0.1:' + zmqPort),
        rpcQueue && ('-rpcworkqueue=' + rpcQueue),
        ...args)))) as Spawn;
  }

  function execCli (...args: string[]): Fn<[Dir]> {
    return Dir(dataDir, Exec(cli,
      rpcPort && ('-rpcport=' + rpcPort),
      rpcUser && `-rpcuser=fadroma`,
      rpcPass && `-rpcpassword=${rpcPass}`,
      dataDir && `-datadir=${dataDir}`,
      regTest && '-regtest',
      ...args));
  }

  function subscribe (onZmq) {
    //await portWait({ port: zmqPort });
    return Sub(zmqPort, onZmq);
  }

  return context
}

export namespace Btc {

  export interface DaemonOptions {
    chain?:                   string,
    daemon?:                  string,
    datadir?:                 string,
    debug?:                   string[]|string,
    defaultpeggedassetname?:  string;
    discover?:                boolean;
    dnsseed?:                 boolean,
    initialfreecoins?:        string|number|bigint;
    initialreissuancetokens?: string|number|bigint;
    persistmempool?:          boolean,
    rest?:                    boolean,
    rpcallowip?:              string[]|string,
    rpcpassword?:             string;
    rpcport?:                 number|string,
    rpcuser?:                 string;
    server?:                  boolean,
    txindex?:                 boolean,
    validatepegin?:           false;
  }

  export interface Daemon extends ChildProcess {
    stdout: ReadableStream
    stderr: ReadableStream
    rpc:    ReturnType<typeof Rpc>
    rest:   ReturnType<typeof Rest>,
  }

  /** Launch an Elementsd localnet suitable
    * for testing SimplicityHL programs. */
  export const Daemon: {
    /** Launch with default settings and temporary datadir. */
    <T> (callback: Fn<[ChildProcess], Async<T>>):
      Promise<Async<T>>;
    /** Launch with specified options. */
    <T> (options: string|DaemonOptions, callback: Fn<[ChildProcess], Async<T>>):
      Promise<Async<T>>;
  } = async function btcDaemon <T> (...args: unknown[]): Promise<Async<T>> {
    const options: DaemonOptions =
      (typeof args[0] === 'string') ? { datadir: args.shift() } :
      (typeof args[0] === 'function') ? {} : args.shift();
    if (typeof options !== 'object') throw new Error('invalid options');
    const {
      daemon                  = 'elementsd',
      chain                   = 'regtest',
      datadir                 = await Temp.make(chain),
      rpcuser                 = `fadroma`,
      rpcpassword             = `fadroma`,
      rpcport                 = '8941',
      rpcallowip              = '127.0.0.1',
      validatepegin           = null,
      defaultpeggedassetname  = null,
      initialfreecoins        = null,
      initialreissuancetokens = null,
      persistmempool          = null,
      dnsseed                 = null,
      server                  = null,
      discover                = null,
      txindex                 = null,
      rest                    = null,
    } = options
    const spawn = Spawn(daemon, ...[
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
      //'-debug=rpc', //'-debug=zmq',
    ].filter(Boolean));
    const process = await spawn();
    try {
      const url = `http://${rpcuser}:${rpcpassword}@${rpcallowip}:${rpcport}`;
      Object.assign(process, { rest: Rest(url), rpc: Rpc(url) });
      return await Pipe(...args as Fn[])(process) as T;
    } finally {
      process.kill();
    }
  }

  /** Daemon's primary JSON-RPC API. */
  export const Rpc = function btcRpc (url: string): {
    generate:         Fn,
    createwallet:     Fn,
    rescanblockchain: Fn,
    getwalletinfo:    Fn,
    getnewaddress:    Fn,
    sendtoaddress:    Fn,
  } {
    const callRpc = (method: string) => async (...params: unknown[]) => {
      const body = { jsonrpc: "1.0", id: 1, method, params, };
      const text = await callUrl(url, 'POST', body);
      return JSON.parse(text).result
    };
    return {
      generate:         callRpc('generate'),
      createwallet:     callRpc('createwallet'),
      rescanblockchain: callRpc('rescanblockchain'),
      getwalletinfo:    callRpc('getwalletinfo'),
      getnewaddress:    callRpc('getnewaddress'),
      sendtoaddress:    callRpc('sendtoaddress'),
    }
  }

  /** Daemon's optional REST API. */
  export const Rest = function btcRest (url: string): {
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

  /** Daemon's ZeroMQ publishers. */
  export const Zmq = () => { throw new Error('TODO') };

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
