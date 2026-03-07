    //debug(`UTXOS of sender (${sender}):`, unspent)
    //process.exit(123);
    //// If no input TX is passed, but a faucet is available, use that.
    //if (!inputTx) {
      //// TODO: try using pre-existing UTXO of test account:
      //// const utxos = await esplora.getAddressUtxos(addr);
      //if (callFaucet) {
        //const { txid } = await callFaucet(sender);
        //if (txid === null) throw new Error(`faucet call failed: ${sender}`);
        //await sleep(15000); // give it a few
        //inputTx = await esplora!.getTxInfo(txid);
      //} else {
        //throw new Error(`required: inputTx, callFaucet, or utxo: ${sender}`)
      //}
    //}
    //debug('Previous:', inputTx);
    //// Find the unspent transaction outpu (support both REST and Esplora schemas)
    //const voutIndex = (x: Btc.Vout|Esplora.Vout) => x?.n ?? x?.vout;
    //const enumerate = <T>(x: T, index: number): [number, T] => [index, x];
    //const isOwnedBy = (sender: string) => ([_, x]) => toAddress(x) === sender;
    //const toAddress = (x: Btc.Vout|Esplora.Vout) => x?.scriptPubKey?.address ?? x?.scriptpubkey_address;
    //const [i, vout] = inputTx.vout.map(enumerate).filter(isOwnedBy(sender))[0];
    //if (!vout) throw new Error('no vout matched in previous tx');
//import * as ZMQ from 'npm:zeromq';
//import type { Async, AsyncIter, Log } from '../../index.ts';
//import { Tcp } from '../../context.ts';
//import { Fn, UTF8, Bytes, Bit, readBytes, readUntilDone, write, merged } from '../../format.ts';
//[>* A ZeroMQ connection. <]
//export type Conn = (AsyncIter<Frame> & ConnOpts) | { socket?: unknown };
//[>* Options for creating a ZeroMQ connection. <]
//export type ConnOpts = Log & {
  //close (): void, readable: ReadableStream, writable: WritableStream, };
//[>* ZeroMQ protocol version. <]
//export type Ver = { maj: number, min: number };
//[>* Known ZeroMQ security mechanisms. <]
//export type Sec = 'NULL'|'PLAIN'|'CURVE';
//[>* Known ZeroMQ command strings. <]
//export type Cmd = 'READY'|string;
//[>* ZeroMQ publisher (server listener). <]
//export type Pub = Conn & {
  //mode: 'PUB'; close: Fn<[]>; send (...msgs: Bytes[]): Promise<void>; };
//[>* ZeroMQ subscriber (client connection). <]
//export type Sub = Conn & {
  //mode: 'SUB'; subscribe (topic: string): Promise<void>; receive (): Promise<Frame[]>; };
//[>* Create ZeroMQ publisher. <]
//export const Pub = merged(function zmqPub (at: number|string|URL, handler: Fn<[unknown], Async<{ close: Fn }>>) {
  //return Fn.Name(`ZMQ PUB ${at}`, async function zmqPublisher (_: unknown): Promise<Pub> {
    //let stopped  = false;
    //const send   = (..._: unknown[]) => { throw new Error('zmq pub send: not implemented') };
    //const close  = () => { stopped = true; (socket as any).close(); };
    //const socket = await Tcp.Listen(at, async connection => {
      //connection.on('error', error => { throw error });
      //await Pub.shake(connection);
      //return handler(connection);
    //});
    //return { mode: 'PUB', socket, send, close };
  //}, { at, handler })
//}, {
  //shake: Fn.Name('ZMQ PUB shake', async (connection) => {
    //await writeCb(connection, Hello({ pub: true }));
    //await connection.read();
    //await connection.read();
    //await writeCb(connection, Frame.ready());
  //})
//});
//[>* Create ZeroMQ subscriber. <]
//export const Sub = merged(async function zmqSub (to: number|string|URL, handler: Fn<[Sub]>) {
  //return Fn.Name(`ZMQ SUB ${to}`, async function zmqSubscriber (
    //_: unknown
  //): Promise<Sub> {
    //const socket = await Tcp.Connect(to);
    //await Sub.shake(socket);
    //const subscribe = async (topicName: string) => {
      //const topic = UTF8.encode(topicName) as Uint8Array;
      //const payload = new Uint8Array(topic.length + 1);
      //payload[0] = 0x01;
      //payload.set(topic, 1);
      //await writeCb(socket, zmqFrame(payload));
    //};
    //const receive = async () => {
      //const res = [];
      //for (let f: Frame; (f = await (Frame as any).read(socket))?.more; f.size > 0) {
        //res.push(zmqFrame(f));
      //}
      //return res;
    //};
    //const close = () => { console.log(socket); socket.end() };
    //return { mode: 'SUB', socket, subscribe, receive, close };
  //}, { to, handler });
//}, {
  //shake: Fn.Name('ZMQ SUB shake', async (socket) => {
    //await writeCb(socket, Hello({ pub: false }));
    //await socket.read();
    //await writeCb(socket, Frame.ready());
    //await socket.read();
  //})
//});
//[>* ZeroMQ greeting options. <]
//export type Hello = { sig: Bytes, sec: Sec, ver: Ver, pub: boolean };
//export const Hello = merged(zmqHello, {
  //size:  64,
  //read:  Fn.Name('Hello', Fn.Pipe(readBytes({ max: 64 }), zmqHello)),
  //write: Fn.Name('Hello', Fn(Fn.Pipe(zmqHello, write))),
//});
//function zmqHello (input?: Bytes): Hello & Bytes;
//function zmqHello (input?: Partial<Hello>): Hello & Bytes;
//function zmqHello (input?: unknown): Hello & Bytes {
  //if (input && input[0]) {
    //const bytes    = Bytes(input);
    //const secBytes = bytes.subarray(12, 12+6);
    //const sec      = UTF8.decode(secBytes.slice(0, secBytes.indexOf(0)||Infinity));
    //const sig      = bytes.subarray(0, 10);
    //const ver      = { maj: bytes[10] & 0xFF, min: bytes[11] & 0xFF };
    //const pub      = bytes[32] === 0x01;
    //return merged(bytes, { sig, sec, ver, pub }) as Hello & Bytes;
  //}
  //const bytes = new Uint8Array(Hello.size);
  //const { pub = false, sec = 'NULL', ver: { maj = 3, min = 0 } = {} } = input as Partial<Hello> || {};
  //const secBytes = UTF8.encode(sec);
  //for (const [byte, value] of Object.entries({
    //0x00: 0xFF,
    //0x08: 0x01,
    //0x09: 0x7F,
    //0x0a: maj & 0xFF,
    //0x0b: min & 0xFF,
    //0x0c: secBytes[0] ?? 0,
    //0x0d: secBytes[1] ?? 0,
    //0x0e: secBytes[2] ?? 0,
    //0x0f: secBytes[3] ?? 0,
    //0x10: secBytes[4] ?? 0,
    //0x11: secBytes[5] ?? 0,
    //0x32: pub ? 0x01: 0x00,
  //})) bytes[byte] = value;
  //const props = { pub, sec, ver: { maj, min } };
  //return merged(bytes, input||{}, props) as Hello & Bytes;
//}

//[>* A ZeroMQ frame packet. <]
//export type Frame = Flags & { size: number, command?: Cmd, offset?: number, payload?: Bytes };
//[>* Known ZeroMQ frame flags. <]
//export type Flags = { more: Bit, long: Bit, cmd: Bit, };
//export const Flags = { cmd: Bit('CMD', 2), long: Bit('LONG', 1), more: Bit('MORE', 0), };
//export const Frame = merged(zmqFrame, {
  //read:  Fn.Pipe(readUntilDone, zmqFrame),
  //write: (frame: Frame) => w => w.write(zmqFrame(frame)),
  //empty: new Uint8Array([1, 0]),
  //payload: (frame: Frame & Bytes, offset = 1): Uint8Array => {
    //const { buf, u8, u64 } = Bytes.parse(frame);
    //const n = frame.long ? Number(u64(offset)) : u8(offset);
    //offset += frame.long ? 4 : 1;
    //return buf(n, offset);
  //},
  //ready: merged(Fn(zmqFrame, { command: 'READY' }), {
    //id:    'READY',
    //read:  Fn.Name('ZMQ>ready', Fn.Pipe(readUntilDone, zmqFrame, zmqExpectCmd('READY'))),
    //write: Fn.Name('ZMQ<ready', writable => writable.write(Frame.ready())),
  //})
//});

//export function zmqFrame (input?: Bytes): Frame & Bytes;
//export function zmqFrame (input?: Partial<Frame>): Frame & Bytes;
//export function zmqFrame (input?: unknown): Frame & Bytes {
  //if (input && typeof input === 'object' && Symbol.iterator in input) {
    //if ((input as []).length === 0) throw new Error('empty frame');
    //const bytes = Bytes(input);
    //const long  = Flags.long(bytes);
    //if (long) throw new Error("long frames not supported yet");
    //const size = Number(Bytes.parse(bytes)[long ? 'u64' : 'u8'](1));
    //const more = Flags.more(bytes);
    //const cmd  = Flags.cmd(bytes);
    //merged(bytes, { size, more, long, cmd });
    //if (cmd) {
      //const command = UTF8.decode(bytes.subarray(3, 3 + bytes[2]));
      //merged(bytes, { command });
    //}
    //return input as Frame & Bytes
  //}
  //const { more = false, command  = null as Cmd|null, ...rest } =
    //(input || {}) as Partial<Frame>;

  //let flag = 0;
  //if (more) flag |= Flags.more.mask;
  //if (command) flag |= Flags.cmd.mask;
  //const length = 1 + (command?.length ?? 0);
  ////if (payloadLength > 0xFF) flag |= Flags.long.mask;
  //return merged(new Uint8Array([
    //Math.min(255, flag),
    //Math.min(255, length),
    //...command ? [
      //Math.min(255, command.length),
      //...UTF8.encode(command),
    //] : []
  //]), rest, {
    //flag, more, command,
    //long: false, //long: payloadLength > 0xFF, 
    ////metadata, metadataLength, payload, payloadLength,
  //}) as Frame & Bytes;

  //[>* Write frame payload. <]
  ////[>* Send messages over pubsub channel. <]
  ////async function zmqPubSend (write: Write, ...msgs: Bytes[]): Promise<void> {
    ////await write(zmqEmptyMore);
    ////if (msgs.length > 0) {
      ////const b = [];
      ////for (let i = 0; i < msgs.length - 1; i++) b.push(zmqFrame(msgs[i], { more: true }));
      ////b.push(zmqFrame(msgs[msgs.length - 1]));
      ////const output = new Uint8Array(b.reduce((l,b)=>l+b.length, 0));
      ////let i = 0; for (const c of b) for (const d of c) output[i++] = d;
      ////await write(output);
    ////}
  ////}
//}

//function zmqExpectCmd (id: Cmd) {
  //return (frame: Frame) => {
    //if (!frame.command) throw new Error(`not a command frame`);
    //if (frame.command !== id) throw new Error(`command not ${id} but ${frame.command}`)
    //return frame;
  //}
//}

//[>* FIXME: WTF <]
//const writeCb = (writable, data): Promise<void> =>
  //new Promise((resolve, reject)=>{
    //writable.once('error', error);
    //try {
      //writable.write(data, () => { resolve() });
      //writable.off('error', error);
    //} catch (e) {
      //reject(e)
      //writable.off('error', error);
    //}
    //function error (e: unknown) {
      //reject(e);
      //writable.off('error', error);
    //};
  //});

//import { Test, defer } from '@hackbg/fadroma';
//import { Pub, Sub, Hello, Frame } from './zmq.ts';
//const { the, suite, is, has, equal } = Test;
//export default suite(import.meta, 'ZeroMQ', 
  //the('Hello packet', () => Hello(),
    //has({ pub: false, sec: 'NULL', ver: { maj: 3, min: 0 } })),
    //the('Read from socket', () => Hello.read(mockReader(new Uint8Array(Hello()))),
      //has({ pub: false, sec: 'NULL', ver: { maj: 3, min: 0 } })),
    //the('Write to socket', () => Hello.write({ pub: true })(mockWriter()),
      //({ writes })=>equal(writes.length, 1)),
  //the('Frame packet',
    //the('Empty frame', () => Frame(),
      //has({ flag: 0, more: false, long: false, command: null })),
    //the('Ready frame', () => Frame({ command: "READY" }),
      //has({ flag: 4, more: false, long: false, command: 'READY' })),
    //the('Decoding', () => Frame.read(mockReader(new Uint8Array(Frame({ command: 'TEST' as any })))),
      //has('command', is('string', 'TEST'))),
    //the('Encoding')),
  //the('Handshake',
    //the('Subscriber side', async () => {
      //const socket = mockSocket(Hello(), Frame.ready());
      //const { writes } = await Sub.shake()(socket);
      //equal(writes.length, 2);
    //}),
    //the('Publisher side', async () => {
      //const socket = mockSocket(Hello(), Frame.ready());
      //const { writes } = await Pub.shake()(socket);
      //equal(writes.length, 2);
    //})),
  //the('Pub', () => Pub(32123, mockCallback()),
    //is('function', `ZMQ PUB 32123`),
    //the('Publish', x => x(),
      //is('object'),
      //has('close', is('function')),
      //has('send',  is('function')),
      //the('Sub', () => Sub(32123, mockCallback()),
        //is('function', `ZMQ SUB 32123`),
        //the('Subscribe', x => x(),
          //is('object'))))))

//function zmqTimeout (t = 10000) {
  //const timeout  = (_, reject)=>setTimeout(timedOut(reject), t);
  //const timedOut = reject => () => reject(new Error('timed out waiting for ZMQ'));
  //return defer(timeout);
//}

//function mockCallback (value = undefined) {
  //const calls = []
  //Object.assign(mockCallback, { calls });
  //Object.setPrototypeOf(mockCallback, { toString: () => 'mockCallback' });
  //return mockCallback
  //function mockCallback (...args) {
    //calls.push(args);
    //return value
  //}
//}

//function mockSocket (...reads: unknown[]) {
  //return { ...mockReader(...reads), ...mockWriter() }
//}

//function mockReader (...reads: unknown[]) {
  //return Object.assign(mockRead, { read: mockRead, reads })
  //async function mockRead () {
    //return ((reads.length > 0) ? { value: reads.shift() } : { done: true })
  //}
//}

//function mockWriter (writes = []) {
  //return Object.assign(mockWrite, { write: mockWrite, writes });
  //async function mockWrite (...args) {
    //return writes.push(args);
  //}
//}

////const testZmqCodec = the('Codec',
  ////the('Hello',   testCall(zmqHello)),
  ////the('Frame',   testCall(Frame)),
  ////the('Command', testCall(Frame, { command: 'READY', metadata: [] })));
////async function testZmqFrameCmd (_) {
  ////const b = new Uint8Array(64);
  ////b[0] |= zmqFlag.cmd.mask;
  ////equal(Frame(b), b);
////}
////async function testZmqFrameCmdReady (_) {
  ////equal([...Frame({ command: 'READY' })], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
  ////throws(Fn(Frame));
  ////throws(Fn(Frame, null));
  ////const b = new Uint8Array(64);
  ////throws(()=>Frame(b));
  ////b[0] |= zmqFlag.cmd.mask;
  ////throws(()=>Frame(b));
  ////Object.assign(b, { name: Frame });
  ////equal(Frame(b)[0], zmqFlag.cmd.mask);
  ////todo(Fn(equal, Frame(b).metadata, []));
////}
//import { Fn, route, param, guard, get, post, BTCJS, interval, serveHttp, getIndexd } from './deps.ts';

//export async function indexer (httpPort: number, rpc, db = new DB('indexd')) {
  //await db.open();
  //const Indexd = await getIndexd();
  //const indexd = new Indexd(db, rpc);
  //return Fn.Name('Indexd API', Fn.Pipe(
    //interval(60000, () => indexd.tryResync()),
    //serveHttp(httpPort, txApi({ rpc, indexd }),
      //bxApi({ rpc, indexd }),
      //rxApi({ rpc }),
      //axApi({ indexd, rpc }))));
//}

//const stubRpc = (...args: unknown[]) => console.debug('TODO:', ...args);

//export const stubZmq = socket => {
  //console.log('zmq connected');
  //socket.on('message', message => console.log('zmq', message));
//};

//[>* Blocks API. <]
//export const bxApi = ({ rpc, indexd }) => route('1/b',
  //get('best',     (_: unknown) => rpc('getbestblockhash', [])),
  //get('fees',     ({query:{count=64}}) => indexd().latestFeesForNBlocks(count),
  //route(':id',
    //param('id',   ({params:{id}}) => (id === 'best') ? rpc('getbestblockhash', []) : id),
    //guard(400,    ({params:{id}}) => isHex64(id)),
    //get('header', ({params:{id}}) => rpc('getblockheader', [id, false])),
    //get('height', ({params:{id}}) => rpc('getblockheader', [id, true])))));

//const isHex64 = (value: unknown) =>
  //(typeof value === 'string') && (value.length == 64); // todo check 0-f

//[>* Address API. <]
//export const axApi = ({
  //rpc, indexd = null, dblimit = null, heightRange = [0, 0xffffffff], mempool = true,
//}) =>
  //route('1/a/:address',
    //param('options', ({params:{scId}}) => ({ scId: toScId(scId), heightRange, mempool })),
    //get('firstseen', ({options}) => indexd().firstSeenScriptId(options.scId)),
    //get('txos',      ({options}) => indexd().txosByScriptRange(options, dblimit)),
    //get('unspents',  ({options}) => indexd().utxosByScriptRange(options, dblimit)),
    //get('txids',     ({options}) => indexd().transactionIdsByScriptRange(options, dblimit)),
    //get('txs',       ({options}) => indexd().transactionIdsByScriptRange(options, dblimit), getRaw(rpc)),
    //get('alt/:address/unspents'));

//const getRaw = rpc => txIds =>
  //Promise.all(txIds.map(txId=>rpc('getrawtransaction', [txId])));

//[>* Transactions API. <]
//export const txApi = ({rpc, indexd}) => route('1/t',
  //get('mempool',     _ => rpc('getrawmempool', [false])),
  //post('push',       ({body}) => rpc('sendrawtransaction', [body])),
  //post('alt/pushtx', ({body:{hex}}) => rpc('sendrawtransaction', [hex])),
  //route(':id',
    //guard(400,       ({params:{id}}) => isHex64(id)),
    //get('block',     ({params:{id}}) => indexd().blockIdByTransactionId(id)),
    //get('',          ({params:{id}}) => rpc('getrawtransaction', [id, false])),
    //get('json',      ({params:{id}}) => rpc('getrawtransaction', [id, false]).then(({
      //txid, hex, vsize, version, locktime, vin, vout,
    //})=>({ txId: txid, txHex: hex, vsize, version, locktime,
      //ins:  vin.map(x => ({ txId:     x.txid
                          //, vout:     x.vout
                          //, script:   x.scriptSig.hex
                          //, sequence: x.sequence })),
      //outs: vout.map(x => ({ script: x.scriptPubKey.hex
                           //, value:  Math.round(x.value * 1e8) [> satoshis <]
                           //, address: x.scriptPubKey.addresses
                               //? x.scriptPubKey.addresses[0]
                               //: x.scriptPubKey.address
                                 //? x.scriptPubKey.address
                                 //: undefined })) })))));

//export const rxApi = ({
  //rpc,
  //auth = [],
  //network = 'regtest' as BTCJS.Network // FIXME?
//}) => route('1/r',
  //guard(401, ({query:{key}}) => !!key),
  //guard(403, ({query:{key}}) => (!(BTCJS.crypto.sha256(key).toString('hex') in auth))),
  //post('generate', ({query:{address, count}}) => address
    //? rpc('generatetoaddress', [parseInt(count) || 1, address])
    //: rpc('getnewaddress', []).then(address =>
        //rpc('generatetoaddress', [parseInt(count) || 1, address]))),
  //post('faucet', ({query:{address,value}}) => rpc('sendtoaddress', [
    //address, parseInt(value) / 1e8, '', '', false, false, null, 'unset', false, 1])),
  //post('faucetScript', async req => {
    //const key = BTCJS.ECPair.makeRandom({ network })
    //const payment = BTCJS.payments.p2pkh({ pubkey: key.publicKey, network })
    //const address = payment.address
    //const scId = BTCJS.crypto.sha256(payment.output).toString('hex')

    //const txId = await pRpc('sendtoaddress', [address, parseInt(req.query.value) * 2 / 1e8, '', '', false, false, null, 'unset', false, 1])
    //let unspent
    //let counter = 10
    //while (!unspent) {
      //const unspents = await pUtxosByScriptRange(scId)
      //unspent = unspents.filter(x => x.txId === txId)[0]
      //if (!unspent) {
        //counter--
        //if (counter <= 0) throw new Error('No outputs')
        //await sleep(10)
      //}
    //}
    //const txvb = new BTCJS.TransactionBuilder(network);
    //txvb.addInput(unspent.txId, unspent.vout, undefined, payment.output);
    //txvb.addOutput(Buffer.from(req.query.script, 'hex'), parseInt(req.query.value));
    //txvb.sign(0, key);
    //const txv = txvb.build();
    //await pRpc('sendrawtransaction', [txv.toHex()])
    //return txv.getId()
  //}));

//const pRpc = async (...args) => { throw new Error('TODO') };
//const pUtxosByScriptRange = async id => { throw new Error('TODO') };
//const sleep = async t => { throw new Error('todo') };

//const toScId = address => BTCJS.crypto.sha256((!address.match(/^[0-9a-f]+$/i))
  //? BTCJS.address.toOutputScript(address, NETWORK)
  //: Buffer.from(address, 'hex')).toString('hex')

////export const zeromqIndexd = (url, indexd, seq = {}) =>
  ////zeromq({ url }, (topic, message, sequence) => {
    ////topic    = topic.toString('utf8');
    ////message  = message.toString('hex');
    ////sequence = sequence.readUInt32LE();
    ////if (seq[topic] === undefined) seq[topic] = sequence;
    ////else seq[topic] += 1;
    ////if (sequence !== seq[topic]) {
      ////if (sequence < seq[topic]) console.debug(`daemon may have restarted`);
      ////else console.debug(`${sequence - seq[topic]} messages lost`);
      ////seq[topic] = sequence;
      ////indexd.tryResync();
    ////}
    ////switch (topic) {
      ////case 'hashblock': return indexd.tryResync();
      ////case 'hashtx':    return indexd.notify(message);
    ////}
  ////});

////export const zeromq = ({
  ////url = null, zmq = ZMQ.default.socket('sub'), sub = ['hashblock', 'hashtx'],
////}, msg) => {
  ////if (url) zmq.connect(url);
  ////if (sub) for (const s of sub) zmq.subscribe(s as string);
  ////if (msg) zmq.on('message', msg);
  ////return zmq
////}
