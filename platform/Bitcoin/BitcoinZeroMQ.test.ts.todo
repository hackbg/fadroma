import { Test, defer } from '@hackbg/fadroma';
import { Pub, Sub, Hello, Frame } from './zmq.ts';
const { the, suite, is, has, equal } = Test;
export default suite(import.meta, 'ZeroMQ', 
  the('Hello packet', () => Hello(),
    has({ pub: false, sec: 'NULL', ver: { maj: 3, min: 0 } })),
    the('Read from socket', () => Hello.read(mockReader(new Uint8Array(Hello()))),
      has({ pub: false, sec: 'NULL', ver: { maj: 3, min: 0 } })),
    the('Write to socket', () => Hello.write({ pub: true })(mockWriter()),
      ({ writes })=>equal(writes.length, 1)),
  the('Frame packet',
    the('Empty frame', () => Frame(),
      has({ flag: 0, more: false, long: false, command: null })),
    the('Ready frame', () => Frame({ command: "READY" }),
      has({ flag: 4, more: false, long: false, command: 'READY' })),
    the('Decoding', () => Frame.read(mockReader(new Uint8Array(Frame({ command: 'TEST' as any })))),
      has('command', is('string', 'TEST'))),
    the('Encoding')),
  the('Handshake',
    the('Subscriber side', async () => {
      const socket = mockSocket(Hello(), Frame.ready());
      const { writes } = await Sub.shake()(socket);
      equal(writes.length, 2);
    }),
    the('Publisher side', async () => {
      const socket = mockSocket(Hello(), Frame.ready());
      const { writes } = await Pub.shake()(socket);
      equal(writes.length, 2);
    })),
  the('Pub', () => Pub(32123, mockCallback()),
    is('function', `ZMQ PUB 32123`),
    the('Publish', x => x(),
      is('object'),
      has('close', is('function')),
      has('send',  is('function')),
      the('Sub', () => Sub(32123, mockCallback()),
        is('function', `ZMQ SUB 32123`),
        the('Subscribe', x => x(),
          is('object'))))))

function zmqTimeout (t = 10000) {
  const timeout  = (_, reject)=>setTimeout(timedOut(reject), t);
  const timedOut = reject => () => reject(new Error('timed out waiting for ZMQ'));
  return defer(timeout);
}

function mockCallback (value = undefined) {
  const calls = []
  Object.assign(mockCallback, { calls });
  Object.setPrototypeOf(mockCallback, { toString: () => 'mockCallback' });
  return mockCallback
  function mockCallback (...args) {
    calls.push(args);
    return value
  }
}

function mockSocket (...reads: unknown[]) {
  return { ...mockReader(...reads), ...mockWriter() }
}

function mockReader (...reads: unknown[]) {
  return Object.assign(mockRead, { read: mockRead, reads })
  async function mockRead () {
    return ((reads.length > 0) ? { value: reads.shift() } : { done: true })
  }
}

function mockWriter (writes = []) {
  return Object.assign(mockWrite, { write: mockWrite, writes });
  async function mockWrite (...args) {
    return writes.push(args);
  }
}

//const testZmqCodec = the('Codec',
  //the('Hello',   testCall(zmqHello)),
  //the('Frame',   testCall(Frame)),
  //the('Command', testCall(Frame, { command: 'READY', metadata: [] })));
//async function testZmqFrameCmd (_) {
  //const b = new Uint8Array(64);
  //b[0] |= zmqFlag.cmd.mask;
  //equal(Frame(b), b);
//}
//async function testZmqFrameCmdReady (_) {
  //equal([...Frame({ command: 'READY' })], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
  //throws(Fn(Frame));
  //throws(Fn(Frame, null));
  //const b = new Uint8Array(64);
  //throws(()=>Frame(b));
  //b[0] |= zmqFlag.cmd.mask;
  //throws(()=>Frame(b));
  //Object.assign(b, { name: Frame });
  //equal(Frame(b)[0], zmqFlag.cmd.mask);
  //todo(Fn(equal, Frame(b).metadata, []));
//}
