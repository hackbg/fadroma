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
  const localnet = Service('BTC Localnet',
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

  /** Launch an Elementsd localnet suitable
    * for testing SimplicityHL programs. */
  export const Localnet: {
    /** Launch with default settings and temporary datadir. */
    <T> (callback: Fn<[ChildProcess], Async<T>>):
      Promise<Async<T>>;
    /** Launch with specified options. */
    <T> (options: string, callback: Fn<[ChildProcess], Async<T>>):
      Promise<Async<T>>;
  } = async function btcLocalnet <T> (...args: unknown[]): Promise<Async<T>> {
    let datadir = null;
    if (typeof args[0] === 'string') datadir = args.shift();
    datadir ||= (await Temp('elements')()).path
    const port = '8941'
    const host = '127.0.0.1'
    const url  = `http://${host}:${port}`;
    const spawn = Spawn('elementsd', ...[
      `-datadir=${datadir}`, '-debug=rpc', '-debug=zmq',
      '-txindex=1', '-persistmempool=0', '-dnsseed=0', '-server',
      '-chain=liquidtestnet', '-rest=1', '-discover=0',
      `-rpcport=${port}`, '-rpcallowip=127.0.0.1',
      '-validatepegin=0',
      '-defaultpeggedassetname=fadroma',
      '-initialfreecoins=100000000000000',
      '-initialreissuancetokens=200000000',
    ]);
    const rest   = Rest(url);
    const rpc    = Rpc(url);
    const daemon = Object.assign(await spawn(), { rest, rpc });
    try {
      return await Pipe(...args as Fn[])(daemon) as T;
    } finally {
      daemon.kill();
    }
  }
 
  /** Daemon's optional REST API. */
  export const Rest = async function btcRest (url: string, id = String(+ new Date())) {
    return {
      async chaininfo () {
        return JSON.parse(await callUrl(`${url}/rest/chaininfo.json`))
      },
      async getutxos (...args: string[]) {
        return JSON.parse(await callUrl(`${url}/rest/getutxos/${args.join('/')}.json`))
      },
    }
  }

  /** Daemon's JSON-RPC API. */
  export const Rpc = async function btcRpc (url: string, id = String(+ new Date())) {
    return {
      async generate (...params: unknown[]) {
        return JSON.parse(await callUrl(url, 'POST', {
          jsonrpc: "1.0", id: `${id}:${+new Date()}`, params, 
          method: 'generate'
        }))
      },
      async getwalletinfo (...params: unknown[]) {
        return JSON.parse(await callUrl(url, 'POST', {
          jsonrpc: "1.0", id: `${id}:${+new Date()}`, params,
          method: 'getwalletinfo'
        }))
      },
    }
  }

  /** Daemon's ZeroMQ publishers. */
  export const Zmq = () => { throw new Error('TODO') };

  async function callUrl (url: string|URL, method = 'GET', body?: BodyInit) {
    const result = await fetch(url, { method, body });
    const text = await result.text();
    const code = result.status;
    if (code !== 200) {
      throw Object.assign(new Error(`${url}: ${code} (${text})`), { code, text })
    } else {
      return text;
    }
  }
}
