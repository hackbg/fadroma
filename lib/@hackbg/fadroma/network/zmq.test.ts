import { call, suite, expect, equal, throws, todo } from '../tester.ts';
import {
  zmqSub, zmqConnect, zmqSubShake,
  zmqEncodeGreet, zmqEncodeFrame, zmqEncodeReady,
  zmqDecodeGreet, zmqDecodeFrame, zmqDecodeCmd, zmqDecodeReady,
  zmqReady, zmqFlagCmd,
} from './zmq.ts';

export const testZmqEncode =
  expect('Encode', testZmqEncodeFrame,
    expect('Ready', testZmqEncodeReady));

export const testZmqDecode =
  expect('Decode',    testZmqDecodeFrame,
    expect('Command', testZmqDecodeCmd,
      expect('Ready', testZmqDecodeReady)));

export default suite(import.meta, 'ZeroMQ',
  expect('Frame', testZmqEncode, testZmqDecode),);

function testZmqEncodeFrame () {
  equal([...zmqEncodeFrame()], [0, 0]);
}

function testZmqEncodeReady () {
  equal([...zmqEncodeReady()], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
  equal([...zmqEncodeReady([])], [ 4, 6, 5, 82, 69, 65, 68, 89 ]);
}

function testZmqDecodeFrame () {
  equal(zmqDecodeFrame(), null);
  const b = new Uint8Array(64);
  equal(zmqDecodeFrame(b), b);
};

function testZmqDecodeCmd () {
  throws(call(zmqDecodeCmd));
  throws(call(zmqDecodeCmd, null));
  const b = new Uint8Array(64);
  throws(call(zmqDecodeCmd, b));
  b[0] |= zmqFlagCmd.mask;
  equal(zmqDecodeCmd(b), b);
};

function testZmqDecodeReady () {
  throws(call(zmqDecodeReady));
  throws(call(zmqDecodeReady, null));
  const b = new Uint8Array(64);
  throws(()=>zmqDecodeReady(b));
  b[0] |= zmqFlagCmd.mask;
  throws(()=>zmqDecodeReady(b));
  Object.assign(b, { name: zmqReady });
  equal(zmqDecodeReady(b)[0], zmqFlagCmd.mask);
  todo(call(equal, zmqDecodeReady(b).metadata, []));
};
