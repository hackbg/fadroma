import { route, param, guard, get, post, BTCJS, isHex64, Name, Pipe, interval, serveHttp, Indexd } from './deps.ts';

export async function indexer (httpPort, rpc, db = new DB('indexd')) {
  await db.open();
  const indexd = new Indexd(db, rpc);
  return Name('Indexd API', Pipe(
    interval(60000, () => indexd.tryResync()),
    serveHttp(httpPort, txApi({ rpc, indexd }),
      bxApi({ rpc, indexd }),
      rxApi({ rpc }),
      axApi({ indexd, rpc }))));
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
