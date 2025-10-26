import { ok, expect, call, testSuite, equal, throws, todo } from '../tester.ts';
import {
  zmqConnect,
  zmqPub, zmqPubShake,
  zmqSub, zmqSubShake,
  zmqEncodeFrame, zmqDecodeFrame,
  zmqReady, zmqFlagCmd, zmqGreetSize,
} from './zmq.ts';

export default testSuite(import.meta, 'ZeroMQ',
  expect('Codec',
    expect('Greet', async function testZmqGreet (ctx) {
      throws(()=>zmqDecodeGreet(null));
      const b = new Uint8Array(64);
      equal(zmqDecodeGreet(b), b);
    }),
    expect('Frame', async function testZmqFrame (ctx) {
      throws(call(zmqDecodeFrame));
      throws(call(zmqDecodeFrame, null));
      const binary  = new Uint8Array(64);
      const decoded = zmqDecodeFrame(b)
      equal(zmqDecodeFrame(b), b);
    },
      expect('Command', async function testZmqFrameCmd (ctx) {
        throws(call(zmqDecodeFrame));
        throws(call(zmqDecodeFrame, null));
        const b = new Uint8Array(64);
        throws(call(zmqDecodeFrame, b));
        b[0] |= zmqFlagFrame.mask;
        equal(zmqDecodeFrame(b), b);
      },
        expect('Ready', async function testZmqFrameCmdReady (ctx) {
          equal([...zmqEncodeFrame({ cmd: true, name: 'READY' })], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
          throws(call(zmqDecodeFrame));
          throws(call(zmqDecodeFrame, null));
          const b = new Uint8Array(64);
          throws(()=>zmqDecodeFrame(b));
          b[0] |= zmqFlagFrame.mask;
          throws(()=>zmqDecodeFrame(b));
          Object.assign(b, { name: zmqFrame });
          equal(zmqDecodeFrame(b)[0], zmqFlagFrame.mask);
          todo(call(equal, zmqDecodeFrame(b).metadata, []));
        })))),
  expect('Pub', async function testZmqPub () {
    const mock    = [];
    const onSub   = (...args) => mock.push(...args);
    const publish = zmqPub({ port: 12321 }, onSub);
    const pub     = await publish();
    equal(typeof pub.stop, 'function');
    pub.stop();
  }),
  expect('Sub', async function testZmqSub () {
    const mock      = [];
    const onSub     = (...args) => mock.push(...args);
    const subscribe = zmqSub({ port: 32123 }, onSub);
    const sub       = await subscribe();
    equal(sub, {});
  }));
