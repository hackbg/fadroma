#!/usr/bin/env -S deno run --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import * as BTC from './btc.ts';
import { Pub, Sub, Hello, Frame } from './zmq.ts';
import { tcpWait } from './deps.ts';
import { Test, defer } from '@hackbg/fadroma';
const { the, suite, is, has, equal, equals } = Test;
export type TestContext = Test.Context & { localnet: unknown };
const _ = undefined;
export default suite(import.meta, 'BTC',

  the('Client',
    the('Template', BTC.client, is('function'), has('name', 'exec bitcoin-cli'),
      the('Constructor', x => x(), is('function'), has('name', 'bitcoin-cli'),
        the('Instance', x => x(mockExecContext()), is('object'), has('mock', [
          { argv: [ 'bitcoin-cli', '-rpcpassword=fadroma', '-regtest', '-rpcport=18443' ]
          , opts: {} }
        ]))))),

  the('Daemon',
    the('Template', BTC.daemon, is('function'), has('name', 'spawn bitcoind'),
      the('Constructor', x => x(), is('function'), has('name', 'bitcoind'),
        the('Instance', x => x(mockSpawnContext()), has('mock', [
          { argv: [ 'bitcoind', '-rpcpassword=fadroma', '-regtest', '-server', '-txindex', '-rpcworkqueue=32', '-rpcport=18443' ]
          , opts: {} }
        ]))))),

  the('ZeroMQ',
    the('Hello packet',
      the('Construct',
        () => Hello(),
        has({ pub: false, sec: 'NULL', ver: { maj: 3, min: 0 } })),
      the('Read from socket',
        () => Hello.read(mockReader(new Uint8Array(Hello()))),
        has({ pub: false, sec: 'NULL', ver:  { maj: 3, min: 0 } })),
      the('Write to socket',
        () => Hello.write({ pub: true })(mockWriter()),
        ({ writes })=>equal(writes.length, 1))),

    the('Frame packet',
      the('Empty frame',
        () => Frame(),
        has({ flag: 0, more: false, long: false, command: null })),
      the('Ready frame',
        () => Frame({ command: "READY" }),
        has({ flag: 4, more: false, long: false, command: 'READY' })),
      the('Decoding',
        () => Frame.read(mockReader(new Uint8Array(Frame({ command: 'TEST' as any })))),
        has('command', 'TEST')),
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

    the('Connect',
      the('Pub', () => Pub(32123, mockCallback()),
        is('function'), has('name', `ZMQ PUB 32123`),
        x => x(), is('object'), has('close'), has('send'),
        the('Sub', () => Sub(32123, mockCallback()),
          is('function'), has('name', `ZMQ SUB 32123`),
          x => x(), is('object'))))),

  the('Localnet',
    the('ZMQ timer', (_, ctx) => { ctx.zmqTest  = zmqTimeout() }),
    the('Launch',    (_, ctx) => { ctx.localnet = BTC.localnet({ onZmq: ctx.zmqTest.resolve }) }),
    the('Timeout',   async (_, ctx) => { await ctx.zmqTest }),
    the('Ready',     async (_, ctx) => { ctx.localnet = await ctx.localnet }),
    the('Subscribe', 'TX', 'Block'),
    the('Query', 'Block', 'Transaction', 'Address'),
    the('Send', 'OP_CHECKSIG'),
    ctx => { if (ctx.localnet?.kill) ctx.localnet.kill() }),
);

function mockExecContext () {
  return { exec  (...args) { this.mock = args; return {} } }
}

function mockSpawnContext () {
  return { spawn (...args) { this.mock = args; return {} } }
}

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
  //throws(call(Frame));
  //throws(call(Frame, null));
  //const b = new Uint8Array(64);
  //throws(()=>Frame(b));
  //b[0] |= zmqFlag.cmd.mask;
  //throws(()=>Frame(b));
  //Object.assign(b, { name: Frame });
  //equal(Frame(b)[0], zmqFlag.cmd.mask);
  //todo(call(equal, Frame(b).metadata, []));
//}
