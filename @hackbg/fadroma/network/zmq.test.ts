import { ok, expect, call, testSuite, equal, todo, must, ditto } from '../tester.ts';
import { reflect } from '../index.ts';
import {
  zmqFlag, zmqFrame, zmqGreet, zmqReadGreet, zmqWriteGreet, zmqPub, zmqSub,
  zmqPubShake, zmqSubShake
} from './zmq.ts';
import { tcpWait } from './tcp.ts';

const _ = undefined;

const mockCallback = (value = undefined) => {
  const calls = []
  return Object.assign(mockCallback, { calls });
  function mockCallback (...args) {
    calls.push(args);
    return value
  }
}

const mockReader = (...reads) => {
  return {
    reads,
    read: async () => ((reads.length > 0) ? { value: reads.shift() } : { done: true })
  }
}

const mockWriter = (...writes) => {
  return {
    writes,
    write: async (...args) => writes.push(args)
  }
}

const testZmqGreet = expect('Greet',
  call(zmqGreet, _),
  must.have('pub', false),
  must.have('sec', 'NULL'),
  must.have('ver', { maj: 3, min: 0 }),
  expect('Read', async () => {
    const reader = mockReader(new Uint8Array(zmqGreet()));
  }),
  expect('Write', async () => {
    const writer = mockWriter();
    const greet  = zmqWriteGreet({ pub: true });
    await greet(writer);
  }));

const testZmqFrame = expect('Frame',
  call(zmqFrame, _),
  must.have('flag',           0),
  must.have('more',           false),
  must.have('long',           false),
  must.have('command',        null),
  must.have('payload',        null),
  must.have('payloadLength',  0),
  must.have('metadata',       null),
  must.have('metadataLength'),
  expect('Ready',
    call(zmqFrame, { command: "READY" }),
    must.have('flag',    4),
    must.have('command', "READY")));

const testZmqShake = expect('Shake', async function testZmqShake () {
  const socket = { ...mockReader(), ...mockWriter() };
  console.log(await zmqPubShake(socket), await zmqSubShake(socket), socket);
  process.exit(123);
});

const testZmqConnect = expect('Connect',
  expect('Pub', call(zmqPub, 32123, mockCallback()),
    must.be('function'),
    must.have('name', `ZeroMQ PUB 32123`),
    ({ returned: publish }) => publish(),
    must.be('object'),
    must.have('write'),
    must.have('kill'),
    expect('Sub', call(zmqSub, 32123, mockCallback()),
      must.be('function'),
      must.have('name', `ZeroMQ SUB 32123`),
      ({ returned: subscribe }) => subscribe(),
      must.be('object'), 
      async function testZmqClose ({ returned: subscription }) {
        await tcpWait({ port: 32123 })();
        await subscription.close()
      })));

export default testSuite(import.meta, 'ZeroMQ',
  testZmqGreet,
  testZmqFrame,
  testZmqShake,
  testZmqConnect);

//const testZmqCodec = expect('Codec',
  //expect('Greet',   testCall(zmqGreet)),
  //expect('Frame',   testCall(zmqFrame)),
  //expect('Command', testCall(zmqFrame, { command: 'READY', metadata: [] })));
//async function testZmqFrameCmd (_) {
  //const b = new Uint8Array(64);
  //b[0] |= zmqFlag.cmd.mask;
  //equal(zmqFrame(b), b);
//}
//async function testZmqFrameCmdReady (_) {
  //equal([...zmqFrame({ command: 'READY' })], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
  //throws(call(zmqFrame));
  //throws(call(zmqFrame, null));
  //const b = new Uint8Array(64);
  //throws(()=>zmqFrame(b));
  //b[0] |= zmqFlag.cmd.mask;
  //throws(()=>zmqFrame(b));
  //Object.assign(b, { name: zmqFrame });
  //equal(zmqFrame(b)[0], zmqFlag.cmd.mask);
  //todo(call(equal, zmqFrame(b).metadata, []));
//}
