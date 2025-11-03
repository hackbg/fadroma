/// Inspired by code by @jjeffcaii (originally published under Apache License 2.0).
/// See https://github.com/jjeffcaii/deno-zeromq/blob/master/LICENSE.
import type { Fn, Flag, AsyncIter, Log, Bytes } from '../index.ts';
import type { TcpConn } from "../deps.ts";
import { setImmediate } from "../deps.ts";
import { UTF8, toU8A, flag, parse, writeBytes, concatBytes } from '../format.ts';
import { readBytes, readUntilDone, write } from './stream.ts';
import { tcpConnect, tcpListen } from './tcp.ts';
import { call, sequence, pipe, reflect, asyncIter, todo } from '../call.ts';
/** A ZeroMQ connection. */
export type ZmqConn = AsyncIter<ZmqFrame> & ZmqConnOpts;
/** Options for creating a ZeroMQ connection. */
export type ZmqConnOpts = Log & {
  close (): void, readable: ReadableStream, writable: WritableStream,
};
/** A ZeroMQ publisher (server listener). */
export type ZmqPub = ZmqConn & {
  mode: 'PUB', kill: Fn<[]>, send (...msgs: Bytes[]): Promise<void>;
};
/** A ZeroMQ subscriber (client connection). */
export type ZmqSub = ZmqConn & {
  mode: 'SUB';
  subscribe (topic: string): Promise<void>;
  receive (): Promise<ZmqFrame[]>;
};
/** ZeroMQ helloing options. */
export type ZmqGreet = { sig: Bytes, sec: ZmqSec, ver: ZmqVer, pub: boolean };
/** ZeroMQ protocol version. */
export type ZmqVer = { maj: number, min: number };
/** Known ZeroMQ security mechanisms. */
export type ZmqSec = 'NULL'|'PLAIN'|'CURVE';
/** Known ZeroMQ frame flags. */
export type ZmqFlags = {
  /** More frames to go. */
  more: Flag,
  /** Frame length is u64 as opposed to u8 */
  long: Flag,
  /** Frame is a command (such as `READY`) */
  cmd:  Flag,
};
/** A ZeroMQ frame packet. */
export type ZmqFrame = ZmqFlags & {
  size: number, command?: ZmqCommand, offset?: number, payload?: Bytes
};
/** Known ZeroMQ command strings. */
export type ZmqCommand = 'READY';

const ZMQ = {

  flag: {
    more: flag('MORE', 0), long: flag('LONG', 1), cmd: flag('CMD', 2), },

  pub: Object.assign(zmqPub, {
    shake: (_payload = []) => reflect('ZMQ PUB shake', sequence(
      ZMQ.hello.write({ pub: true }),
      ZMQ.hello.read,
      ZMQ.frame.ready.write,
      ZMQ.frame.ready.read)) }),

  sub: Object.assign(zmqSub, {
    shake: () => reflect('ZMQ SUB shake', sequence(
      ZMQ.hello.write({ pub: false }),
      ZMQ.hello.read,
      ZMQ.frame.ready.read,
      ZMQ.frame.ready.write)) }),

  hello: Object.assign(zmqGreet, {
    size: 64,
    read:  reflect('ZMQ>hello', pipe(readBytes({ max: 64 }), zmqGreet)),
    write: reflect('ZMQ<hello', call(pipe(zmqGreet, write))), }),

  frame: Object.assign(zmqFrame, {
    read:  pipe(readUntilDone, zmqFrame),
    write: (frame: ZmqFrame) => ({ write }) => write(zmqFrame(frame)),
    empty: new Uint8Array([1, 0]),
    payload: (frame: ZmqFrame & Bytes, offset = 1): Uint8Array => {
      const { buf, u8, u64 } = parse(frame);
      const n = frame.long ? Number(u64(offset)) : u8(offset);
      offset += frame.long ? 4 : 1;
      return buf(n, offset);
    },
    ready: Object.assign(call(zmqFrame, { command: 'READY' }), {
      id:    'READY',
      read:  reflect('ZMQ>ready', pipe(readUntilDone, zmqFrame, zmqExpectCommand('READY'))),
      write: reflect('ZMQ<ready', ({ write }) => write(ZMQ.frame.ready())),
    })
  }),

}

export default ZMQ;

function zmqExpectCommand (id: ZmqCommand) {
  return (frame: ZmqFrame) => {
    console.log('->',frame);
    if (frame.command !== id) throw new Error('not a READY frame');
    return frame;
  }
}

/** Launch a ZeroMQ publisher. */
export function zmqPub (at: number|string|URL, handler: Fn<[TcpConn]>) {
  return reflect(`ZMQ PUB ${at}`,
    async function zmqPublisher (_: unknown): Promise<ZmqPub> {
      let stopped  = false;
      const kill   = () => { stopped = true; };
      const socket = await tcpListen(at);
      const props  = { mode: 'PUB', socket, write, kill, };
      return asyncIter(zmqPubs)(Object.assign(socket, props));
      async function * zmqPubs () {
        for await (const connection of socket) {
          console.log(connection);
          await ZMQ.pub.shake()(connection);
          yield connection;
          if (stopped) break;
        }
      }
    }, { at, handler })
}

/** Launch a ZeroMQ subscription. */
export function zmqSub (to: number|string|URL, handler: Fn<[ZmqSub]>) {
  return reflect(`ZMQ SUB ${to}`, async function zmqSubscriber (_: unknown): Promise<ZmqSub> {
    let   stopped   = false;
    const socket    = await tcpConnect(to);
    const subscribe = (t: string) => zmqSubAddTopic(socket, t);
    const receive   = () => zmqSubReceive(socket);
    const close     = () => { stopped = true; socket.close() };
    Object.assign(socket, { subscribe, receive, close });
    const shook = await ZMQ.sub.shake()(socket);
    const subscription = asyncIter(zmqSubIterator)(socket);
    setImmediate(zmqSubIterate);
    return subscription;
    async function * zmqSubIterator (): AsyncIterableIterator<ZmqFrame> {
      while (!stopped) {
        const chunks = [];
        while (true) {
          const { done, value } = await socket.read()
          if (value) chunks.push(value);
          if (done) break;
        }
        if (chunks.length > 0) {
          const bytes = concatBytes(chunks);
          chunks.length = 0;
          yield zmqFrame(bytes)
        }
      }
    }
    async function * zmqSubIterate () {
      while (!stopped) for await (const frame of subscription) {
        yield frame;
      }
    }
  }, { to, handler });
  /** Receive published messages. */
  async function zmqSubReceive ({ read }): Promise<ZmqFrame[]> {
    const res = [];
    for (let frame: ZmqFrame;
      (frame = await ZMQ.frame.read(read))?.more;
      (frame.size > 0) && res.push(zmqFrame(frame)));
    return res;
  }
  /** Add a subscription. */
  async function zmqSubAddTopic ({ write }, topicName: string) {
    const topic = UTF8.encode(topicName) as Uint8Array;
    const payload = new Uint8Array(topic.length + 1);
    payload[0] = 0x01;
    payload.set(topic, 1);
    await write(zmqFrame(payload));
  }
}

/** Produce a valid ZeroMQ `GREET`.
  * When passed array-like, tries to parse as byte buffer.
  * When passed nothing or object, generates byte buffer. */
export function zmqGreet (input?: Bytes): ZmqGreet & Bytes;
export function zmqGreet (input?: Partial<ZmqGreet>): ZmqGreet & Bytes;
export function zmqGreet (input?: unknown): ZmqGreet & Bytes {
  if (input && input[0]) {
    const bytes    = toU8A(input);
    const secBytes = bytes.subarray(12, 12+6);
    const sec      = UTF8.decode(secBytes.slice(0, secBytes.indexOf(0)||Infinity));
    const sig      = bytes.subarray(0, 10);
    const ver      = { maj: bytes[10] & 0xFF, min: bytes[11] & 0xFF };
    const pub      = bytes[32] === 0x01;
    return Object.assign(bytes, { sig, sec, ver, pub }) as ZmqGreet & Bytes;
  }
  const bytes = new Uint8Array(ZMQ.hello.size);
  const { pub = false, sec = 'NULL', ver: { maj = 3, min = 0 } = {} } = input as Partial<ZmqGreet> || {};
  const secBytes = UTF8.encode(sec);
  for (const [byte, value] of Object.entries({
    0x00: 0xFF,
    0x08: 0x01,
    0x09: 0x7F,
    0x0a: maj & 0xFF,
    0x0b: min & 0xFF,
    0x0c: secBytes[0] ?? 0,
    0x0d: secBytes[1] ?? 0,
    0x0e: secBytes[2] ?? 0,
    0x0f: secBytes[3] ?? 0,
    0x10: secBytes[4] ?? 0,
    0x11: secBytes[5] ?? 0,
    0x32: pub ? 0x01: 0x00,
  })) bytes[byte] = value;
  const props = { pub, sec, ver: { maj, min } };
  return Object.assign(bytes, input||{}, props) as ZmqGreet & Bytes;
}

/** Produce a valid ZeroMQ `GREET`.
  * 
  * When passed null, returns null. 
  * When passed array-like, tries to parse as byte buffer.
  * When passed nothing or object, generates byte buffer. */
export function zmqFrame (input?: Bytes): ZmqFrame & Bytes;
export function zmqFrame (input?: Partial<ZmqFrame>): ZmqFrame & Bytes;
export function zmqFrame (input?: unknown): ZmqFrame & Bytes {
  if (input && typeof input === 'object' && Symbol.iterator in input) {
    if (input.length === 0) throw new Error('empty frame');
    const bytes  = toU8A(input);
    const long   = ZMQ.flag.long(bytes);
    if (long) throw new Error("long frames not supported yet");
    const size   = Number(parse(bytes)[long ? 'u64' : 'u8'](1));
    const more   = ZMQ.flag.more(bytes);
    const cmd    = ZMQ.flag.cmd(bytes);
    //const offset = 1 + (long ? 8 : 1);
    Object.assign(bytes, { size, more, long, cmd });
    if (cmd) {
      const command = UTF8.decode(bytes.subarray(3, 3 + bytes[2]));
      Object.assign(bytes, { command });
      //if (command === ZMQ.ready.id) {
        //const metadata = [];
        //const { u8, u32, str } = parse(bytes);
        //for (
          //let cursor = offset + 1 + ZMQ.ready.id.length;
          //cursor < bytes.length;
        //) {
          //const n = (metadata.length % 2 === 0) ? u8(cursor) : u32(cursor);
          //cursor += (metadata.length % 2 === 0) ? 1 : 4;
          //metadata.push(str(n, cursor));
          //cursor += n;
        //}
        //Object.assign(bytes, { metadata });
      //}
    }
    return input as ZmqFrame & Bytes
  }

  const { more = false, command  = null as ZmqCommand|null, ...rest } =
    (input || {}) as Partial<ZmqFrame>;

  let flag = 0;
  if (more) flag |= ZMQ.flag.more.mask;
  if (command) flag |= ZMQ.flag.cmd.mask;
  const length = 1 + (command?.length ?? 0);
  //if (payloadLength > 0xFF) flag |= ZMQ.flag.long.mask;
  return Object.assign(new Uint8Array([
    Math.min(255, flag),
    Math.min(255, length),
    ...command ? [
      Math.min(255, command.length),
      ...UTF8.encode(command),
    ] : []
  ]), rest, {
    flag, more, command,
    long: false, //long: payloadLength > 0xFF, 
    //metadata, metadataLength, payload, payloadLength,
  }) as ZmqFrame & Bytes;

  /** Write frame payload. */
  ///** Send messages over pubsub channel. */
  //async function zmqPubSend (write: Write, ...msgs: Bytes[]): Promise<void> {
    //await write(zmqEmptyMore);
    //if (msgs.length > 0) {
      //const b = [];
      //for (let i = 0; i < msgs.length - 1; i++) b.push(zmqFrame(msgs[i], { more: true }));
      //b.push(zmqFrame(msgs[msgs.length - 1]));
      //const output = new Uint8Array(b.reduce((l,b)=>l+b.length, 0));
      //let i = 0; for (const c of b) for (const d of c) output[i++] = d;
      //await write(output);
    //}
  //}
}
