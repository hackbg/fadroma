import {
  BTCJS, Indexd, DB, RPC, ZMQ
  shell, spawn, serve, compose, every, env, arg, run, api, rest, ware, get, post
  isHex64,
} from './deps.ts';

/** Spawn BTC localnet in regression test mode with indexer and API. */
export const localnet = ({
  daemon     = 'bitcoind',
  client     = 'bitcoin-cli',
  zmqUrl     = 'tcp://127.0.0.1:30001',
  indexDb    = 'regtest.db',
  url        = 'http://localhost:8332',
  batch      = 500,
  concurrent = 16,
  rpcwq      = 32,

  _rpc2       = 'http://localhost:18443',
  _keyDb      = 'regtest.keys',

  index      = DB(indexDb),
  rpc        = RPC.default({ url, auth, batch, concurrent }),
  indexd     = new Indexd(index, rpc),
  zmq        = zeromqIndexd(zmqUrl, indexd),
  address    = run(client, arg('-regtest'), arg('getnewaddress'), arg('""'), arg('bech32')),
}) => compose('Bitcoin Localnet API',
  spawn(daemon, arg('-server'), arg('-regtest'), arg('-txindex'),
    arg(`-zmqpubhashtx=${zmqUrl}`), arg(`-zmqpubhashblock=${zmqUrl}`),
    arg(`-rpcworkqueue=${rpcwq}`)),
  shell(client, arg('-regtest'), arg('createwallet'), arg('default')),
  shell(client, arg('-regtest'), arg('generatetoaddress'), arg('432'), arg(address)),
  every(60000, () => indexd.tryResync),
  serve(rest('1', txApi, bxApi(rpc), rxApi([]), axApi(indexd))));

/** Transactions API. */
export const txApi =
  rest('t',
    get('mempool'),
    post('push',       ware(bodyParser.text())),
    post('alt/pushtx', ware(bodyParser.json())),
    rest(':id',
      ware(req => { if (!isHex64(req.params.id)) return 400; }),
      get(),
      get('json'),
      get('block')));

/** Blocks API. */
export const bxApi = rpc =>
  rest('b',
    get('best'),
    get('fees'),
    rest(':id',
      ware(req => {if (req.params.id === 'best') req.params.id = await rpc('getbestblockhash', []);}),
      ware(req => {if (!isHex64(req.params.id)) return res.easy(400); next()}),
      get('header'),
      get('height')));

export const rxApi = auth =>
  rest('r',
    ware(req => {
      if (!req.query.key) return 401
      let hash = bitcoin.crypto.sha256(req.query.key).toString('hex')
      if (!(hash in auth)) return 403
    }),
    post('generate'),
    post('faucet'),
    post('faucetScript'));

/** Accounts API. */
export const axApi = (indexd, heightRange = [0, 0xffffffff]) =>
  rest('a/:address',
    ware(req => {
      const { address } = req.params;
      script = (!address.match(/^[0-9a-f]+$/i)) ? bitcoin.address.toOutputScript(address, NETWORK) : Buffer.from(address, 'hex')
      req.params.scId = bitcoin.crypto.sha256(script).toString('hex')
    }),
    get('firstseen', req => indexd().firstSeenScriptId(req.params.scId)),
    get('txs',       req => indexd().transactionIdsByScriptRange({ scId: req.params.scId, heightRange, mempool: true, }, DBLIMIT, txIds => Promise.all(txIds.map(txId=>rpc('getrawtransaction', [txId]))))),
    get('txids',     req => indexd().transactionIdsByScriptRange({ scId: req.params.scId, heightRange, mempool: true, }, DBLIMIT)),
    get('txos',      req => indexd().txosByScriptRange({ scId: req.params.scId, heightRange, mempool: true, }, DBLIMIT)),
    get('unspents',  req => indexd().utxosByScriptRange({ scId: req.params.scId, heightRange, mempool: true, }, DBLIMIT)),
    get('alt/:address/unspents'));

export const zeromqIndexd = (url, indexd, seq = {}) =>
  zeromq({ url }, (topic, message, sequence) => {
    topic    = topic.toString('utf8');
    message  = message.toString('hex');
    sequence = sequence.readUInt32LE();
    if (seq[topic] === undefined) seq[topic] = sequence;
    else seq[topic] += 1;
    if (sequence !== seq[topic]) {
      if (sequence < seq[topic]) console.debug(`daemon may have restarted`);
      else console.debug(`${sequence - seq[topic]} messages lost`);
      seq[topic] = sequence;
      indexd.tryResync();
    }
    switch (topic) {
      case 'hashblock': return indexd.tryResync();
      case 'hashtx':    return indexd.notify(message);
    }
  });

export const zeromq = ({
  url = null, zmq = ZMQ.default.socket('sub'), sub = ['hashblock', 'hashtx'],
}, msg) => {
  if (url) zmq.connect(url);
  if (sub) for (const s of sub) zmq.subscribe(s as string);
  if (msg) zmq.on('message', msg);
  return zmq
}
