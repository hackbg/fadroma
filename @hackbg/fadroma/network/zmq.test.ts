import { ok, expect, call, testSuite, equal, todo, must, ditto } from '../tester.ts';
import { zmqFlag, zmqFrame, zmqGreet, zmqPub, zmqSub } from './zmq.ts';

const _ = undefined;
const mockCallback = (value = undefined) => {
  const calls = []
  return Object.assign(function mockCallback (...args) {
    calls.push(args);
    return value
  }, { calls })
}

export default testSuite(import.meta, 'ZeroMQ',
  expect('Codec',
    expect('Greet',
      call(zmqGreet, _),
      must.have('pub', false),
      must.have('sec', 'NULL'),
      must.have('ver', { maj: 3, min: 0 })),
    expect('Frame',
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
        must.have('command', "READY")))),

  expect('Sub', call(zmqSub, 32123, mockCallback()),
    must.be('function'),
    must.have('name', `ZeroMQ SUB 32123`),
    expect('scribe', ditto(), must.be('object'))),

  expect('Pub', call(zmqPub, 32123, mockCallback()),
    must.be('function'),
    must.have('name', `ZeroMQ PUB 32123`),
    expect('lish', ditto(), must.be('object')))

);

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
