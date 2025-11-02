import ZeroMQ from './zmq.ts';
import $ from '../tester.ts';
const { ditto, suite, expect: the, must: { be: is, have: has } } = $;
import { tcpWait } from './tcp.ts';

export default suite(import.meta, 'ZeroMQ',

  the('Greet', () => ZeroMQ.greet(),
    has('pub', false),
    has('sec', 'NULL'),
    has('ver', { maj: 3, min: 0 }),
    the('Read', async () => {
      const reader = mockReader(new Uint8Array(ZeroMQ.greet()));
      console.log({reader});
    }),
    the('Write', async () => {
      const writer = mockWriter();
      const greet  = ZeroMQ.greet.write({ pub: true });
      await greet(writer);
    })),

  the('Frame', () => ZeroMQ.frame(),
    has('flag', 0), has('more', false), has('long', false),
    has('command',  null),
    has('payload',  null), has('payloadLength', 0),
    has('metadata', null), has('metadataLength'),
    the('Ready', () => ZeroMQ.frame({ command: "READY" }),
      has('flag', 4), has('command', "READY")),
    the('Shake', async function testZmqShake () {
      const socket = {
        ...mockReader(ZeroMQ.frame({ command: 'READY' })),
        ...mockWriter(),
      };
      console.log({socket});
      console.log(await ZeroMQ.shake.sub()(socket));
      console.log(await ZeroMQ.shake.pub()(socket));
    })),

  the('Connect',
    the('Pub',
      () => ZeroMQ.pub(32123, mockCallback()),
      is('function'), has('name', `ZeroMQ PUB 32123`),
      ditto(),
      is('object'), has('write'), has('kill'),
      the('Sub',
        () => ZeroMQ.sub(32123, mockCallback()),
        is('function'), has('name', `ZeroMQ SUB 32123`),
        ditto(),
        is('object'), async function testZmqClose ({ returned: subscription }) {
          await tcpWait({ port: 32123 })();
          await subscription.close()
        }))));

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

function mockReader (...reads) {
  return {
    reads,
    read: async () => ((reads.length > 0) ? { value: reads.shift() } : { done: true })
  }
}

function mockWriter (...writes) {
  return {
    writes,
    write: async (...args) => writes.push(args)
  }
}

//const testZmqCodec = the('Codec',
  //the('Greet',   testCall(zmqGreet)),
  //the('Frame',   testCall(ZeroMQ.frame)),
  //the('Command', testCall(ZeroMQ.frame, { command: 'READY', metadata: [] })));
//async function testZmqFrameCmd (_) {
  //const b = new Uint8Array(64);
  //b[0] |= zmqFlag.cmd.mask;
  //equal(ZeroMQ.frame(b), b);
//}
//async function testZmqFrameCmdReady (_) {
  //equal([...ZeroMQ.frame({ command: 'READY' })], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
  //throws(call(ZeroMQ.frame));
  //throws(call(ZeroMQ.frame, null));
  //const b = new Uint8Array(64);
  //throws(()=>ZeroMQ.frame(b));
  //b[0] |= zmqFlag.cmd.mask;
  //throws(()=>ZeroMQ.frame(b));
  //Object.assign(b, { name: ZeroMQ.frame });
  //equal(ZeroMQ.frame(b)[0], zmqFlag.cmd.mask);
  //todo(call(equal, ZeroMQ.frame(b).metadata, []));
//}
