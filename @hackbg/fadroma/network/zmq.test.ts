import { ok, expect, call, testSuite, equal, throws, todo } from '../tester.ts';
import { zmqFlag, zmqFrame, zmqGreet, zmqPub, zmqPubShake, zmqSub, zmqSubShake, } from './zmq.ts';
import type { ZmqFrame } from './zmq.ts';

//const testZmqCodec = expect('Codec',
  //expect('Greet',   testCall(zmqGreet)),
  //expect('Frame',   testCall(zmqFrame)),
  //expect('Command', testCall(zmqFrame, { command: 'READY', metadata: [] })));
const testZmqCodec = expect('Codec',
  expect('Greet',   testZmqGreet),
  expect('Frame',   testZmqFrame),
  expect('Command', testZmqFrameCmd),
  expect('Ready',   testZmqFrameCmdReady));
async function testZmqGreet (_) {
  throws(()=>zmqGreet(null));
  const b = new Uint8Array(64);
  equal(zmqGreet(b), b);
}
async function testZmqFrame (_) {
  throws(call(zmqFrame));
  throws(call(zmqFrame, null));
  const binary = new Uint8Array(64);
  equal(zmqFrame(binary), binary);
}
async function testZmqFrameCmd (_) {
  throws(call(zmqFrame));
  throws(call(zmqFrame, null));
  const b = new Uint8Array(64);
  throws(call(zmqFrame, b as Partial<ZmqFrame>));
  b[0] |= zmqFlag.cmd.mask;
  equal(zmqFrame(b), b);
}
async function testZmqFrameCmdReady (_) {
  equal([...zmqFrame({ command: 'READY' })], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
  throws(call(zmqFrame));
  throws(call(zmqFrame, null));
  const b = new Uint8Array(64);
  throws(()=>zmqFrame(b));
  b[0] |= zmqFlag.cmd.mask;
  throws(()=>zmqFrame(b));
  Object.assign(b, { name: zmqFrame });
  equal(zmqFrame(b)[0], zmqFlag.cmd.mask);
  todo(call(equal, zmqFrame(b).metadata, []));
}

export const testZmqPub = expect('Pub', async function testZmqPub () {
  const mock    = [];
  const publish = zmqPub(12321, (...args) => mock.push(...args));
  const pub     = await publish();
  equal(typeof pub.stop, 'function');
  pub.stop();
});

export const testZmqSub = expect('Sub', async function testZmqSub () {
  const mock      = [];
  const subscribe = zmqSub(32123, (...args) => mock.push(...args));
  const sub       = await subscribe();
  equal(sub, {});
});

export default testSuite(import.meta, 'ZeroMQ',
  testZmqCodec, testZmqPub, testZmqSub);
