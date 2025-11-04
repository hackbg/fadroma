import type { Fn } from './deps.ts';
import { Sub } from './zmq.ts';
import { joined, call, reflect, service, dir, exec, spawn, interval, tcpWait,
  serveHttp, route, param, guard, get, post, merge,
  BTCJS, Indexd, DB, isHex64 } from './deps.ts';

export {
  btcLocalnet as localnet,
  btcDaemon   as daemon,
  btcClient   as client,
}

export type LocalnetConfig = {
  regTest:    boolean
  btcPort:    number
  zmqPort:    number
  httpPort:   number
  dataRoot:   string
  dataDir:    string
  walletDir:  string
  bitcoinCli: unknown
  bitcoind:   unknown
  elementsd:  unknown
  rpc:        unknown
  indexd:     unknown
  db:         DB,
  onZmq:      Fn
};

/** Spawn BTC localnet in regression test mode with indexer and API.
 *
 * Slimmed-down reimplementation of https://github.com/bitcoinjs/regtest-server */
function btcLocalnet (...config: Partial<LocalnetConfig>[]) {

  let {
    regTest    = true,
    btcPort    = regTest ? 18443 : 8443,
    zmqPort    = 48485,
    httpPort   = 48484,
    dataRoot   = '/tmp/fadroma/test/btc/',
    dataDir    = joined('', dataRoot, 'data',   +new Date()),
    walletDir  = joined('', dataRoot, 'wallet', +new Date()),
    rpc        = stubRpc,
    onZmq      = stubZmq,
    db         = new DB('indexd'),
    indexd     = new Indexd(db, rpc),
    bitcoinCli = btcClient({ regTest, dataDir }),
    bitcoind   = btcDaemon({ regTest, dataDir, btcPort, zmqPort }),
    elementsd  = (...arg) => spawn('elementsd', ...arg), // TODO
  }: LocalnetConfig = merge(config);

  if (typeof bitcoind === 'string') {
    bitcoind = btcDaemon({ bitcoind, regTest, dataDir, btcPort, zmqPort })
  }
  if (typeof bitcoinCli === 'string') {
    bitcoinCli = btcClient({ bitcoinCli, regTest, dataDir })
  }

  return service('BTC Localnet',
    (_)=>db.open(),
    dir(dataDir),
    bitcoind(),
    tcpWait({ port: zmqPort }),
    async context => context.zmq = await Sub(zmqPort, onZmq),
    dir(walletDir),
    tcpWait({ port: btcPort }),
    bitcoinCli('createwallet', walletDir),
    bitcoinCli(`-rpcwallet=${walletDir}`, '-generate'),
    interval(60000, () => indexd.tryResync()),
    serveHttp(httpPort, txApi({ rpc, indexd }),
                        bxApi({ rpc, indexd }),
                        rxApi({ rpc }),
                        axApi({ indexd, rpc })));
}

/** Call Bitcoin CLI. */
function btcClient ({
  bitcoinCli = 'bitcoin-cli',
  dataDir = null,
  regTest = true,
  btcPort = regTest ? 18443 : 8443,
  rpcPw   = 'fadroma',
} = {}) {
  return reflect(`exec ${bitcoinCli}`, call(exec, bitcoinCli,
    rpcPw   && `-rpcpassword=${rpcPw}`,
    dataDir && `-datadir=${dataDir}`,
    regTest && '-regtest',
    btcPort && ('-rpcport=' + btcPort)));
}

/** Spawn Bitcoin daemon. */
function btcDaemon ({
  bitcoind = 'bitcoind',
  dataDir = null,
  regTest = true,
  btcPort = regTest ? 18443 : 8443,
  zmqPort = null,
  txIndex = true,
  rpcPw   = 'fadroma',
  rpcWq   = 32,
} = {}) {
  return reflect(`spawn ${bitcoind}`, call(spawn, bitcoind,
    rpcPw   && `-rpcpassword=${rpcPw}`,
    dataDir && `-datadir=${dataDir}`,
    regTest && '-regtest',
    '-server',
    txIndex && '-txindex',
    zmqPort && ('-zmqpubhashblock=tcp:/' + '/127.0.0.1:' + zmqPort),
    zmqPort && ('-zmqpubhashtx=tcp:/'    + '/127.0.0.1:' + zmqPort),
    rpcWq   && ('-rpcworkqueue=' + rpcWq),
    btcPort && ('-rpcport=' + btcPort)));
}

const stubRpc = (...args: unknown[]) => console.debug('TODO:', ...args);

export const stubZmq = socket => {
  console.log('zmq connected');
  socket.on('message', message => console.log('zmq', message));
};

/** Blocks API. */
export const bxApi = ({ rpc, indexd }) => route('1/b',
  get('best',     (_: unknown) => rpc('getbestblockhash', [])),
  get('fees',     ({query:{count=64}}) => indexd().latestFeesForNBlocks(count),
  route(':id',
    param('id',   ({params:{id}}) => (id === 'best') ? rpc('getbestblockhash', []) : id),
    guard(400,    ({params:{id}}) => isHex64(id)),
    get('header', ({params:{id}}) => rpc('getblockheader', [id, false])),
    get('height', ({params:{id}}) => rpc('getblockheader', [id, true])))));

/** Address API. */
export const axApi = ({
  rpc, indexd = null, dblimit = null, heightRange = [0, 0xffffffff], mempool = true,
}) =>
  route('1/a/:address',
    param('options', ({params:{scId}}) => ({ scId: toScId(scId), heightRange, mempool })),
    get('firstseen', ({options}) => indexd().firstSeenScriptId(options.scId)),
    get('txos',      ({options}) => indexd().txosByScriptRange(options, dblimit)),
    get('unspents',  ({options}) => indexd().utxosByScriptRange(options, dblimit)),
    get('txids',     ({options}) => indexd().transactionIdsByScriptRange(options, dblimit)),
    get('txs',       ({options}) => indexd().transactionIdsByScriptRange(options, dblimit), getRaw(rpc)),
    get('alt/:address/unspents'));

const getRaw = rpc => txIds =>
  Promise.all(txIds.map(txId=>rpc('getrawtransaction', [txId])));

/** Transactions API. */
export const txApi = ({rpc, indexd}) => route('1/t',
  get('mempool',     _ => rpc('getrawmempool', [false])),
  post('push',       ({body}) => rpc('sendrawtransaction', [body])),
  post('alt/pushtx', ({body:{hex}}) => rpc('sendrawtransaction', [hex])),
  route(':id',
    guard(400,       ({params:{id}}) => isHex64(id)),
    get('block',     ({params:{id}}) => indexd().blockIdByTransactionId(id)),
    get('',          ({params:{id}}) => rpc('getrawtransaction', [id, false])),
    get('json',      ({params:{id}}) => rpc('getrawtransaction', [id, false]).then(({
      txid, hex, vsize, version, locktime, vin, vout,
    })=>({ txId: txid, txHex: hex, vsize, version, locktime,
      ins:  vin.map(x => ({ txId:     x.txid
                          , vout:     x.vout
                          , script:   x.scriptSig.hex
                          , sequence: x.sequence })),
      outs: vout.map(x => ({ script: x.scriptPubKey.hex
                           , value:  Math.round(x.value * 1e8) /* satoshis */
                           , address: x.scriptPubKey.addresses
                               ? x.scriptPubKey.addresses[0]
                               : x.scriptPubKey.address
                                 ? x.scriptPubKey.address
                                 : undefined })) })))));

export const rxApi = ({
  rpc,
  auth = [],
  network = 'regtest' as BTCJS.Network // FIXME?
}) => route('1/r',
  guard(401, ({query:{key}}) => !!key),
  guard(403, ({query:{key}}) => (!(BTCJS.crypto.sha256(key).toString('hex') in auth))),
  post('generate', ({query:{address, count}}) => address
    ? rpc('generatetoaddress', [parseInt(count) || 1, address])
    : rpc('getnewaddress', []).then(address =>
        rpc('generatetoaddress', [parseInt(count) || 1, address]))),
  post('faucet', ({query:{address,value}}) => rpc('sendtoaddress', [
    address, parseInt(value) / 1e8, '', '', false, false, null, 'unset', false, 1])),
  post('faucetScript', async req => {
    const key = BTCJS.ECPair.makeRandom({ network })
    const payment = BTCJS.payments.p2pkh({ pubkey: key.publicKey, network })
    const address = payment.address
    const scId = BTCJS.crypto.sha256(payment.output).toString('hex')

    const txId = await pRpc('sendtoaddress', [address, parseInt(req.query.value) * 2 / 1e8, '', '', false, false, null, 'unset', false, 1])
    let unspent
    let counter = 10
    while (!unspent) {
      const unspents = await pUtxosByScriptRange(scId)
      unspent = unspents.filter(x => x.txId === txId)[0]
      if (!unspent) {
        counter--
        if (counter <= 0) throw new Error('No outputs')
        await sleep(10)
      }
    }
    const txvb = new BTCJS.TransactionBuilder(network);
    txvb.addInput(unspent.txId, unspent.vout, undefined, payment.output);
    txvb.addOutput(Buffer.from(req.query.script, 'hex'), parseInt(req.query.value));
    txvb.sign(0, key);
    const txv = txvb.build();
    await pRpc('sendrawtransaction', [txv.toHex()])
    return txv.getId()
  }));

const pRpc = async (...args) => { throw new Error('TODO') };
const pUtxosByScriptRange = async id => { throw new Error('TODO') };
const sleep = async t => { throw new Error('todo') };

const toScId = address => BTCJS.crypto.sha256((!address.match(/^[0-9a-f]+$/i))
  ? BTCJS.address.toOutputScript(address, NETWORK)
  : Buffer.from(address, 'hex')).toString('hex')

//export const zeromqIndexd = (url, indexd, seq = {}) =>
  //zeromq({ url }, (topic, message, sequence) => {
    //topic    = topic.toString('utf8');
    //message  = message.toString('hex');
    //sequence = sequence.readUInt32LE();
    //if (seq[topic] === undefined) seq[topic] = sequence;
    //else seq[topic] += 1;
    //if (sequence !== seq[topic]) {
      //if (sequence < seq[topic]) console.debug(`daemon may have restarted`);
      //else console.debug(`${sequence - seq[topic]} messages lost`);
      //seq[topic] = sequence;
      //indexd.tryResync();
    //}
    //switch (topic) {
      //case 'hashblock': return indexd.tryResync();
      //case 'hashtx':    return indexd.notify(message);
    //}
  //});

//export const zeromq = ({
  //url = null, zmq = ZMQ.default.socket('sub'), sub = ['hashblock', 'hashtx'],
//}, msg) => {
  //if (url) zmq.connect(url);
  //if (sub) for (const s of sub) zmq.subscribe(s as string);
  //if (msg) zmq.on('message', msg);
  //return zmq
//}
