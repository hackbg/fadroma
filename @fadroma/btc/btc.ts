import { Sub } from './zmq.ts';
import { Fn, Service, joined, Dir, Exec, Spawn, Port, merge } from './deps.ts';

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
  } = merge(...options);

  const btcArgs = [
    rpcPort && ('-rpcport=' + rpcPort),
    rpcUser && `-rpcuser=fadroma`,
    rpcPass && `-rpcpassword=${rpcPass}`,
    dataDir && `-datadir=${dataDir}`,
    regTest && '-regtest',
  ].filter(Boolean);

  const spawnNode = (...args: string[]) => Service(`Spawn(${node})`,
    Dir(dataDir), Port(rpcPort, Spawn(node, ...btcArgs, '-server',
      txIndex  && '-txindex',
      zmqPort  && ('-zmqpubhashblock=tcp:/' + '/127.0.0.1:' + zmqPort),
      zmqPort  && ('-zmqpubhashtx=tcp:/'    + '/127.0.0.1:' + zmqPort),
      rpcQueue && ('-rpcworkqueue=' + rpcQueue),
      ...args))) as Spawn;

  const execCli = (...args: string[]) => Service(`Exec(${cli})`,
    Dir(dataDir), Exec(cli, ...btcArgs, ...args)) as Exec;

  return {
    spawnNode,
    execCli,
    localnet: Service('BTC Localnet',
      spawnNode(),
      Dir(walletDir,
        Fn(execCli, 'createwallet', walletDir),
        Fn(execCli, `-rpcwallet=${walletDir}`, '-generate'))),
    async subscribe (onZmq) {
      //await portWait({ port: zmqPort });
      return Sub(zmqPort, onZmq);
    }
  }
}

export type Btc = {
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
  localnet:  (_: unknown) => Service,
};
