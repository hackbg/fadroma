import {
  compose, exec, spawn, every, arg,
  serveTcp, serveHttp, rest, ware, get, post,

  Indexd, DB, RPC, isHex64, ECPair, TransactionBuilder,
  sha256, p2pkh, toOutputScript,
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
  auth       = [],
  httpPort   = 48484,
  zmqPort    = 48485,

  _rpc2      = 'http://localhost:18443',
  _keyDb     = 'regtest.keys',

  index      = DB(indexDb),
  rpc        = RPC.default({ url, auth, batch, concurrent }),
  indexd     = new Indexd(index, rpc),
  //zmq        = zeromqIndexd(zmqUrl, indexd),
  address    = exec(client, arg('-regtest'), arg('getnewaddress'), arg('""'), arg('bech32')),
} = {}) => compose('Bitcoin Localnet API',
  spawn(daemon, arg('-server'), arg('-regtest'), arg('-txindex'),
    arg(`-zmqpubhashtx=${zmqUrl}`), arg(`-zmqpubhashblock=${zmqUrl}`),
    arg(`-rpcworkqueue=${rpcwq}`)),
  exec(client, arg('-regtest'), arg('createwallet'), arg('default')),
  exec(client, arg('-regtest'), arg('generatetoaddress'), arg('432'), arg(address)),
  every(60000, () => indexd.tryResync()),
  serveTcp(zmqPort, _socket => {}),
  serveHttp(httpPort,
    txApi({ rpc, indexd }),
    bxApi({ rpc, indexd }),
    rxApi({ rpc }),
    axApi({ indexd })));

/** Transactions API. */
export const txApi = ({ rpc, indexd }) => rest('1/t',
  get('mempool', req => rpc('getrawmempool', [false])),
  post('push', ware(bodyParser.text()), req => rpc('sendrawtransaction', [req.body]),
  post('alt/pushtx', ware(bodyParser.json()), req => rpc('sendrawtransaction', [req.body.hex])),
  rest(':id', must(400, req => isHex64(req.params.id)),
    get(req => rpc('getrawtransaction', [req.params.id, false])),
    get('json', req => rpc('getrawtransaction', [req.params.id, false]).then(tx=>({
      txId: tx.txid, txHex: tx.hex, vsize: tx.vsize, version: tx.version, locktime: tx.locktime,
      ins: tx.vin.map(x => ({
        txId: x.txid, vout: x.vout, script: x.scriptSig.hex, sequence: x.sequence
      })),
      outs: tx.vout.map(x => ({
        address: x.scriptPubKey.addresses ? x.scriptPubKey.addresses[0] : x.scriptPubKey.address ? x.scriptPubKey.address : undefined,
        script: x.scriptPubKey.hex, value: Math.round(x.value * 1e8) // satoshis
      })),
    })))),
    get('block', req => indexd().blockIdByTransactionId(req.params.id))));

/** Blocks API. */
export const bxApi = ({ indexd, rpc }) => rest('1/b',
  get('best', req => rpc('getbestblockhash', [])),
  get('fees', req => indexd().latestFeesForNBlocks(req.query.count || 64),
  rest(':id',
    param('id', r => (r.params.id === 'best') ? rpc('getbestblockhash', []) : r.params.id),
    must(400, req => isHex64(req.params.id)),
    get('header', req => rpc('getblockheader', [req.params.id, false])),
    get('height', req => rpc('getblockheader', [req.params.id, true])))));

export const rxApi = ({ rpc, auth = [] }) => rest('1/r',
  must(401, req => !!req.query.key),
  must(403, req => (!(sha256(req.query.key).toString('hex') in auth))),
  post('generate', (req, res) => {
    if (req.query.address) {
      rpc('generatetoaddress', [parseInt(req.query.count) || 1, req.query.address], res.easy)
    } else {
      rpc('getnewaddress', [], (err, address) => {
        if (err) return res.easy(err)
        rpc('generatetoaddress', [parseInt(req.query.count) || 1, address], res.easy)
      })
    }
  }),
  post('faucet', req => rpc('sendtoaddress', [
    req.query.address, parseInt(req.query.value) / 1e8, '', '', false, false, null, 'unset', false, 1
  ])),
  post('faucetScript', async (req, res) => {
    try {
      const key = ECPair.makeRandom({ network: NETWORK })
      const payment = p2pkh({ pubkey: key.publicKey, network: NETWORK })
      const address = payment.address
      const scId = sha256(payment.output).toString('hex')

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
      const txvb = new TransactionBuilder(NETWORK);
      txvb.addInput(unspent.txId, unspent.vout, undefined, payment.output);
      txvb.addOutput(Buffer.from(req.query.script, 'hex'), parseInt(req.query.value));
      txvb.sign(0, key);
      const txv = txvb.build();
      await pRpc('sendrawtransaction', [txv.toHex()])
      res.easy(undefined, txv.getId())
    } catch (err) {
      res.easy(err)
    }
  }));

/** Address API. */
export const axApi = ({ indexd = null, dblimit = null, heightRange = [0, 0xffffffff] }) =>
  rest('1/a/:address',
    param('scId', toScId),
    get('firstseen', req => indexd().firstSeenScriptId(req.params.scId)),
    get('txs',       req => indexd().transactionIdsByScriptRange({
      scId: req.params.scId, heightRange, mempool: true, }, dblimit),
      txIds => Promise.all(txIds.map(txId=>rpc('getrawtransaction', [txId])))),
    get('txids',     req => indexd().transactionIdsByScriptRange({
      scId: req.params.scId, heightRange, mempool: true, }, dblimit)),
    get('txos',      req => indexd().txosByScriptRange({
      scId: req.params.scId, heightRange, mempool: true, }, dblimit)),
    get('unspents',  req => indexd().utxosByScriptRange({
      scId: req.params.scId, heightRange, mempool: true, }, dblimit)),
    get('alt/:address/unspents'));

const param = (name, fn) => ware(async req => req.params[name] = await fn(req));

const must  = (code, fn) => ware(async req => { if (!await fn(req)) return code });

const toScId = req => sha256((!req.params.address.match(/^[0-9a-f]+$/i))
  ? toOutputScript(req.params.address, NETWORK)
  : Buffer.from(req.params.address, 'hex')).toString('hex')

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
