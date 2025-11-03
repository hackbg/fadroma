#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import ZMQ from './zmq.ts';
import $, { equal } from '../tester.ts';
const { ditto: called, suite, expect: the, must: { be: is, have: has } } = $;
import { tcpWait } from './tcp.ts';

export default suite(import.meta, 'ZMQ',

  the('Hello packet', () => ZMQ.hello(),
    has('pub', false),
    has('sec', 'NULL'),
    has('ver', { maj: 3, min: 0 }),
    the('Read',       () => ZMQ.hello.read(mockReader(new Uint8Array(ZMQ.hello()))),
      has('pub', false),
      has('sec', 'NULL'),
      has('ver', { maj: 3, min: 0 })),
    the('Write',      () => ZMQ.hello.write({ pub: true })(mockWriter()),
      ({ returned: { writes } })=>equal(writes.length, 1))),

  the('Frame packet',
    the('Empty', () => ZMQ.frame(),
      has('flag', 0),
      has('more', false),
      has('long', false),
      has('command',  null)),
    //has('payload',  null),
    //has('payloadLength', 0),
    //has('metadata', null),
    //has('metadataLength'),
    the('Ready', () => ZMQ.frame({ command: "READY" }),
      has('flag', 4),
      //has('payload', []),
      //has('payloadLength', 6),
      has('command', "READY")),
    the('Read', () => ZMQ.frame.read(mockReader(new Uint8Array(ZMQ.frame({ command: 'TEST' as any })))),
      has('command', 'TEST')),
    the('Write', () => {})),

  the('Handshake',
    the('Subscriber side', async function testZmqShake () {
      const { writes } = await ZMQ.sub.shake()({
        ...mockReader(ZMQ.hello(), ZMQ.frame.ready()), ...mockWriter(),
      });
      equal(writes.length, 2);
    }),
    the('Publisher side', async function testZmqShake () {
      const { writes } = await ZMQ.pub.shake()({
        ...mockReader(ZMQ.hello(), ZMQ.frame.ready()), ...mockWriter(),
      });
      equal(writes.length, 2);
    })),

  the('Connect',
    the('Pub',
      () => ZMQ.pub(32123, mockCallback()),
      is('function'), has('name', `ZMQ PUB 32123`),
      called(),
      is('object'), has('write'), has('kill'),
      the('Sub',
        () => ZMQ.sub(32123, mockCallback()),
        is('function'), has('name', `ZMQ SUB 32123`),
        called(),
        is('object'), async function testZmqClose ({ returned: subscription }) {
          console.log(123);
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
  //the('Frame',   testCall(ZMQ.frame)),
  //the('Command', testCall(ZMQ.frame, { command: 'READY', metadata: [] })));
//async function testZmqFrameCmd (_) {
  //const b = new Uint8Array(64);
  //b[0] |= zmqFlag.cmd.mask;
  //equal(ZMQ.frame(b), b);
//}
//async function testZmqFrameCmdReady (_) {
  //equal([...ZMQ.frame({ command: 'READY' })], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
  //throws(call(ZMQ.frame));
  //throws(call(ZMQ.frame, null));
  //const b = new Uint8Array(64);
  //throws(()=>ZMQ.frame(b));
  //b[0] |= zmqFlag.cmd.mask;
  //throws(()=>ZMQ.frame(b));
  //Object.assign(b, { name: ZMQ.frame });
  //equal(ZMQ.frame(b)[0], zmqFlag.cmd.mask);
  //todo(call(equal, ZMQ.frame(b).metadata, []));
//}
