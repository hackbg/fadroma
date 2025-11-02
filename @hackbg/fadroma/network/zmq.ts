/// Inspired by code by @jjeffcaii (originally published under Apache License 2.0).
/// See https://github.com/jjeffcaii/deno-zeromq/blob/master/LICENSE.
import type { Fn, Flag, AsyncIter, Log, Bytes, Reader, Read, Writer, Write, Async } from '../index.ts';
import type { TcpConn } from "../deps.ts";
import { setImmediate } from "../deps.ts";
import { UTF8, toU8A, flag, parse, writeAdvance, concatBytes } from '../format.ts';
import { readBytes, readUntilDone, write } from './stream.ts';
import { tcpConnect, tcpListen } from './tcp.ts';
import { call, sequence, pipe, reflect, asyncIter } from '../call.ts';
/** Known ZeroMQ connection modes. */
export type ZmqMode  = 'PUB'|'SUB';
/** A ZeroMQ connection. */
export type ZmqConn  = AsyncIter<ZmqFrame> & ZmqConnOpts;
/** Options for creating a ZeroMQ connection. */
export type ZmqConnOpts = Log & {
  close (): void,
  readable: ReadableStream,
  writable: WritableStream,
};
/** Known ZeroMQ frame flags. */
export type ZmqFlags = {
  /** More frames to go. */
  more: Flag,
  /** Frame length is u64 as opposed to u8 */
  long: Flag,
  /** Frame is a command (such as `READY`) */
  cmd:  Flag,
};
/** ZeroMQ flags. */
export const zmqFlag: ZmqFlags = {
  more: flag('MORE', 0),
  long: flag('LONG', 1),
  cmd:  flag('CMD',  2),
}
/** A ZeroMQ subscriber (client connection). */
export type ZmqSub = ZmqConn & {
  mode: 'SUB';
  subscribe (topic: string): Promise<void>;
  receive (): Promise<ZmqFrame[]>;
};

/** Launch a ZeroMQ subscription. */
export function zmqSub (to: number|string|URL, handler: Fn<[ZmqSub]>) {
  return reflect(`ZeroMQ SUB ${to}`, async function zmqSubscriber (_: unknown): Promise<ZmqSub> {
    let   stopped   = false;
    const socket    = await tcpConnect(to);
    const subscribe = (t: string) => zmqSubAddTopic(socket, t);
    const receive   = () => zmqSubReceive(socket);
    const close     = () => { stopped = true; socket.close() };
    Object.assign(socket, { subscribe, receive, close });
    const shook = await zmqSubShake()(socket);
    console.log({shook});
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
    async function zmqSubIterate () {
      while (!stopped) for await (const frame of subscription) {
        console.log({frame});
      }
    }
  }, { to, handler });
}

/** The subscriber's side of the ZeroMQ handshake. */
export const zmqSubShake = () => reflect('ZMQ SUB shake', sequence(
  reflect("Write hello", zmqWriteGreet()),
  reflect("Read hello",  zmqReadGreet),
  reflect("Read ready",  zmqReadReady),
  reflect("Write ready", zmqWriteReady)));
/** The publisher's side of the ZeroMQ handshake. */
export const zmqPubShake = (metadata = []) =>
  reflect('ZMQ PUB shake', sequence(
    reflect('Write hello', zmqWriteGreet({ pub: true })),
    reflect('Read hello',  zmqReadGreet),
    reflect('Write ready', zmqWriteFrame({ command: zmqReady, metadata })),
    reflect('Read ready',  zmqReadFrame)));
/** Read and decode a ZeroMQ greet. */
export const zmqReadGreet = pipe(readBytes({ max: 64 }), zmqGreet) as
  Fn<[Read], Async<ZmqFrame>>;
/** Encode and write a ZeroMQ greet. */
export const zmqWriteGreet = call(pipe(zmqGreet, write));

async function zmqReadReady <R extends Reader> (s: R) {
  const frame = await zmqReadFrame(s.read) as ZmqFrame;
  console.log({frame});
  const { command, metadata } = frame;
  if (command !== zmqReady) throw new Error('not a READY frame');
  Object.assign(s, { metadata }) as R & { metadata: string[] };
}

async function zmqWriteReady <W extends Writer> (s: W & { metadata: string[] }) {
  const frame = zmqFrame({ command: zmqReady, metadata: s.metadata } as Partial<ZmqFrame>);
  s.write(frame);
}

/** Write frame payload. */
function toPayload (frame: ZmqFrame & Bytes, offset = 1): Uint8Array {
  const { buf, u8, u64 } = parse(frame);
  const n = frame.long ? Number(u64(offset)) : u8(offset);
  offset += frame.long ? 4 : 1;
  return buf(n, offset);
};

/** Receive published messages. */
async function zmqSubReceive ({ read }): Promise<ZmqFrame[]> {
  const res = [];
  for (let frame: ZmqFrame;
    (frame = await zmqReadFrame(read))?.more;
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

/** A ZeroMQ publisher (server listener). */
export type ZmqPub = ZmqConn & {
  mode: 'PUB';
  kill: Fn<[]>;
  send (...msgs: Bytes[]): Promise<void>;
};

/** Launch a ZeroMQ publisher. */
export function zmqPub (at: number|string|URL, handler: Fn<[TcpConn]>) {
  return reflect(`ZeroMQ PUB ${at}`,
    async function zmqPublisher (_: unknown): Promise<ZmqPub> {
      let stopped  = false;
      const kill   = () => { stopped = true; };
      const socket = await tcpListen(at);
      const props  = { mode: 'PUB', socket, write, kill, };
      return asyncIter(zmqPubs)(Object.assign(socket, props));
      async function * zmqPubs () {
        for await (const connection of socket) {
          await zmqPubShake()(connection);
          yield connection;
          if (stopped) break;
        }
      }
    }, { at, handler })
}

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
/** Zero-length ZeroMQ frame with `MORE` flag set. */
export const zmqEmptyMore = zmqFrame(new Uint8Array([zmqFlag.more.mask, 0]));
/** ZeroMQ greeting options. */
export type ZmqGreet = { sig: Bytes, sec: ZmqSec, ver: ZmqVer, pub: boolean };
/** ZeroMQ protocol version. */
export type ZmqVer = { maj: number, min: number };
/** Known ZeroMQ security mechanisms. */
export type ZmqSec = 'NULL'|'PLAIN'|'CURVE';
/** Buffer size for greet packet. */
export const zmqGreetSize = 64;
/** Produce a valid ZeroMQ `GREET`.
  * When passed array-like, tries to parse as byte buffer.
  * When passed nothing or object, generates byte buffer. */
export function zmqGreet (input?: Bytes): ZmqGreet & Bytes;
export function zmqGreet (input?: Partial<ZmqGreet>): ZmqGreet & Bytes;
export function zmqGreet (input?: unknown): ZmqGreet & Bytes {
  if (input && input[0]) {
    const bytes = toU8A(input);
    return Object.assign(bytes, {
      sig: bytes.subarray(0, 10),
      sec: UTF8.decode(bytes.subarray(12, 6)),
      ver: { maj: bytes[10] & 0xFF, min: bytes[11] & 0xFF },
      pub: bytes[32] === 0x01,
    }) as ZmqGreet & Bytes;
  }
  const bytes = new Uint8Array(zmqGreetSize);
  const { pub = false, sec = 'NULL', ver: { maj = 3, min = 0 } = {} } =
    (input ||= {}) as Partial<ZmqGreet>;
  bytes[0] = 0xFF;
  bytes[8] = 0x01;
  bytes[9] = 0x7F;
  bytes[10] = maj & 0xFF;
  bytes[11] = min & 0xFF;
  const mechanism = UTF8.encode(sec);
  bytes.set(mechanism.length < 6 ? mechanism : mechanism.subarray(0, 5), 12);
  if (pub) bytes[32] = 0x01;
  return Object.assign(bytes, input, {
    pub, sec, ver: { maj, min }
  }) as ZmqGreet & Bytes;
}
/** A ZeroMQ frame packet. */
export type ZmqFrame = ZmqFlags & {
  size:      number
  payload:   Bytes
  payloadAt: number
  command?:  ZmqCommand,
  metadata?: string[],
};
/** Known ZeroMQ command strings. */
export type ZmqCommand = 'READY';
/** Name of ZeroMQ ready command. */
export const zmqReady: ZmqCommand = 'READY';
/** Read and decode a ZeroMQ frame. */
export const zmqReadFrame = pipe(
  readUntilDone, zmqFrame) as Fn<[Read], Async<ZmqFrame>>;
/** Encode and write a ZeroMQ frame. */
export const zmqWriteFrame = (frame: ZmqFrame) => ({ write }) => write(zmqFrame(frame));
/** Produce a valid ZeroMQ `GREET`.
  * When passed array-like, tries to parse as byte buffer.
  * When passed nothing or object, generates byte buffer. */
export function zmqFrame (input?: Bytes): ZmqFrame & Bytes;
export function zmqFrame (input?: Partial<ZmqFrame>): ZmqFrame & Bytes;
export function zmqFrame (input?: unknown): ZmqFrame & Bytes {
  if (input && input[0]) {
    const bytes = toU8A(input);
    const long = zmqFlag.long(bytes);
    const size = Number(parse(bytes)[long ? 'u64' : 'u8'](1));
    const more = zmqFlag.more(bytes);
    const cmd = zmqFlag.cmd(bytes);
    const payloadAt = 1 + (long ? 8 : 1);
    Object.assign(bytes, { size, more, long, cmd, payloadAt });
    if (cmd) {
      const len = bytes[payloadAt];
      const start = bytes[payloadAt + 1];
      const name = UTF8.decode(bytes.subarray(start, start + len));
      Object.assign(bytes, { name });
      if (name === zmqReady) {
        const offset = payloadAt + 1 + zmqReady.length;
        const metadata = [];
        const { u8, u32, str } = parse(bytes);
        for (let cursor = offset; cursor < bytes.length;) {
          const n = (metadata.length % 2 === 0) ? u8(cursor) : u32(cursor);
          cursor += (metadata.length % 2 === 0) ? 1 : 4;
          metadata.push(str(n, cursor));
          cursor += n;
        }
        Object.assign(bytes, { metadata });
      }
    }
    return input as ZmqFrame & Bytes
  }
  const {
    more     = false,
    command  = null as ZmqCommand|null,
    metadata = null,
    ...rest
  } = (input ||= {}) as Partial<ZmqFrame>;
  let flag = 0;
  if (more) flag |= zmqFlag.more.mask;
  if (command) flag |= zmqFlag.cmd.mask;
  const metadataLength = metadata => (!!metadata) ? 0 : metadata
    .map((v: { length: number }, i: number) => v.length + (i % 2 === 0 ? 1 : 4))
    .reduce((a: number, b: number) => a + b, 0);
  const payloadLength = 0
    + (command  ? (1 + command.length)     : 0)
    + (metadata ? metadataLength(metadata) : 0);
  if (payloadLength > 0xFF) {
    flag |= zmqFlag.long.mask;
  }
  const payload = (command === zmqReady)
    ? []
    : null;
  const frameLength = (payloadLength > 0xFF)
    ? 1 + 8 + payloadLength
    : 1 + 1 + payloadLength;
  const { u8, u32, u64, str, done } = writeAdvance(new Uint8Array(frameLength));
  u8(flag);
  if (payloadLength > 0xFF) {
    u64(BigInt(payloadLength));
  } else {
    u8(payloadLength);
  }
  if (command) {
    u8(command.length);
    str(command);
    if (command === zmqReady) {
      metadata && metadata.forEach((it: string, i: number) => {
        ((i % 2 === 0) ? u8 : u32)(it.length);
        str(it);
      });
    }
  }
  return Object.assign(done(), rest, {
    flag, more, long: payloadLength > 0xFF, command,
    metadata, metadataLength,
    payload, payloadLength,
  }) as ZmqFrame & Bytes;
}

export default {
  greet: Object.assign(zmqGreet, {
    read:  zmqReadGreet,
    write: zmqWriteGreet,
  }),
  shake: {
    sub: zmqSubShake,
    pub: zmqPubShake,
  },
  frame: zmqFrame,
  pub: zmqPub,
  sub: zmqSub,
}
