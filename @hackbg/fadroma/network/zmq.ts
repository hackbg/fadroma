/// Inspired by code by @jjeffcaii (originally published under Apache License 2.0).
/// See https://github.com/jjeffcaii/deno-zeromq/blob/master/LICENSE.
import type { Fn, AsyncIter, Log, Bytes, Reader, Read, Write, Async } from '../index.ts';
import type { TcpConn } from "../deps.ts";
import { connect, listen, setImmediate } from "../deps.ts";
import { dumpHex, UTF8, flag, parse, writeAdvance, concatBytes } from '../format.ts';
import { toRW, readBytes, readUntilDone } from '../network.ts';
import { sequence, setProp, pipe, requiredLate, reflect, asyncIter } from '../call.ts';
import { logger } from '../logger.ts';
/** ZeroMQ protocol version. */
export type ZmqVer   = { maj: number, min: number };
/** Known ZeroMQ connection modes. */
export type ZmqMode  = 'PUB'|'SUB';
/** Known ZeroMQ security mechanisms. */
export type ZmqSec   = 'NULL'|'PLAIN'|'CURVE';
/** A ZeroMQ greeting packet. */
export type ZmqGreet = Bytes & { sig: Bytes, sec: ZmqSec, ver: ZmqVer, pub: boolean };
/** Known ZeroMQ frame flags. */
export type ZmqFlags = { more: boolean, long: boolean, cmd: boolean, };
/** A ZeroMQ frame packet. */
export type ZmqFrame = Bytes & ZmqFlags & { size: number, payloadAt: number; };
/** A ZeroMQ frame packet with command flag and name. */
export type ZmqCmd   = ZmqFrame & { cmd: true, name: string };
/** A ZeroMQ command frame packet with list of metadata. */
export type ZmqReady = ZmqCmd & { metadata: string [] };
/** A ZeroMQ connection. */
export type ZmqConn  = AsyncIter<ZmqFrame> & ZmqConnOpts;
/** Options for creating a ZeroMQ connection. */
export type ZmqConnOpts = Log & {
  readable: ReadableStream
  writable: WritableStream,
  close (): void,
};
/** A ZeroMQ publisher (server listener). */
export type ZmqPub = ZmqConn & {
  mode: 'PUB';
  kill: Fn<[]>;
  send (...msgs: Bytes[]): Promise<void>;
};
/** A ZeroMQ subscriber (client connection). */
export type ZmqSub = ZmqConn & {
  mode: 'SUB';
  subscribe (topic: string): Promise<void>;
  receive (): Promise<ZmqFrame[]>;
};
/** ZeroMQ flag that there's more frames. */
export const zmqFlagMore  = flag('MORE', 0);
/** ZeroMQ flag that the frame length is u64 */
export const zmqFlagLong  = flag('LONG', 1);
/** ZeroMQ flag that the frame is a command */
export const zmqFlagCmd   = flag('CMD',  2);
/** Empty ZeroMQ frame with only the "more" flag set. */
export const zmqEmptyMore = zmqDecodeFrame(new Uint8Array([1, 0]));
/** Name of ZeroMQ ready command. */
export const zmqReady     = 'READY';
/** Launch a ZeroMQ subscription. */
export function zmqSub ({ port, hostname = 'localhost' }, handler: Fn<[ZmqSub]>) {
  return reflect(`ZMQ SUB ${hostname}:${port}`, async function zmqSubscriber (_: unknown): Promise<ZmqSub> {
    let   stopped   = false;
    const socket    = await connect({ transport: 'tcp', port, hostname })
    const state     = toRW(socket);
    const handshake = zmqSubShake();
    const subscribe = (t: string) => zmqSubAddTopic(state, t);
    const receive   = () => zmqSubReceive(state);
    const close     = () => { stopped = true; socket.close() };
    Object.assign(state, { subscribe, receive, close })
    await handshake(state);
    const subscription = asyncIter(zmqSubIterator)(state);
    setImmediate(zmqSubIterate);
    return subscription;
    async function * zmqSubIterator (): AsyncIterableIterator<ZmqFrame> {
      while (!stopped) {
        const chunks = [];
        while (true) {
          const { done, value } = await state.read()
          if (value) chunks.push(value);
          if (done) break;
        }
        if (chunks.length > 0) {
          const bytes = concatBytes(chunks);
          chunks.length = 0;
          yield zmqDecodeFrame(bytes)
        }
      }
    }
    async function zmqSubIterate () {
      while (!stopped) for await (const frame of subscription) {
        console.log({frame});
      }
    }
  }, { handler });
}
/** The subscriber's side of the ZeroMQ handshake. */
export const zmqSubShake = () => sequence(
  reflect("Write hello", s => s.write(zmqEncodeGreet())),
  reflect("Read hello",  s => zmqReadGreet(s.read)),
  reflect("Read ready", async (s: Reader) => {
    const { name, metadata } = await zmqReadFrame(s.read) as ZmqReady;
    console.log({name, metadata});
    if (name !== zmqReady) throw new Error('not a READY frame');
    Object.assign(s, { meta: metadata })}),
  reflect("Write ready", s => s.write(zmqEncodeReady(s.meta))));
/** Write frame payload. */
const toPayload = (frame: ZmqFrame, offset = 1): Uint8Array => {
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
    (frame.size > 0) && res.push(zmqDecodeFrame(frame)));
  return res;
}
/** Add a subscription. */
async function zmqSubAddTopic ({ write }, topicName: string) {
  const topic = UTF8.encode(topicName) as Uint8Array;
  const payload = new Uint8Array(topic.length + 1);
  payload[0] = 0x01;
  payload.set(topic, 1);
  await write(zmqEncodeFrame(payload));
}

/** Launch a ZeroMQ publisher. */
export function zmqPub ({ port, hostname = 'localhost' }, handler: Fn<[TcpConn]>) {
  return reflect(`ZMQ PUB ${hostname}:${port}`,
    async function zmqPublisher (_: unknown): Promise<ZmqPub> {
      let stopped = false;
      const kill = () => { stopped = true };
      const socket = listen({ transport: 'tcp', hostname, port });
      const handshake = zmqPubShake();
      return asyncIter(zmqPubs)({
        mode: 'PUB',
        socket,
        send: (...msgs: Bytes[]) => zmqPubSend(zmq, ...msgs),
        kill,
      });
      async function * zmqPubs () {
        for await (const connection of socket) {
          await handshake(connection);
          yield connection;
          if (stopped) break;
        }
      }
    }, { port, handler })
}

/** The publisher's side of the ZeroMQ handshake. */
const zmqPubShake = (metadata = []) => sequence(
  reflect('Write hello', s => s.write(zmqEncodeGreet({ pub: true }))),
  reflect('Read hello',  s => zmqReadGreet(s.read)),
  reflect('Write ready', s => s.write(zmqEncodeReady(metadata))),
  reflect('Read ready',  s => zmqReadFrame(s.read)));

/** Send messages over pubsub channel. */
async function zmqPubSend (write: Write, ...msgs: Bytes[]): Promise<void> {
  await write(zmqEmptyMore);
  if (msgs.length > 0) {
    const b = [];
    for (let i = 0; i < msgs.length - 1; i++) b.push(zmqEncodeFrame(msgs[i], { more: true }));
    b.push(zmqEncodeFrame(msgs[msgs.length - 1]));
    const output = new Uint8Array(b.reduce((l,b)=>l+b.length, 0));
    let i = 0; for (const c of b) for (const d of c) output[i++] = d;
    await write(output);
  }
}

/** Buffer size for greet packet. */
export const zmqGreetSize = 64;

/** Read and decode the initial greeting packet. */
export const zmqReadGreet: Fn<[Read], Async<ZmqGreet>> = pipe(
  readUntilDone, zmqDecodeGreet);

/** Decode the initial greeting packet. */
export function zmqDecodeGreet (bytes: Bytes) {
  return Object.assign(bytes, {
    sig: bytes.subarray(0, 10),
    sec: UTF8.decode(bytes.subarray(12, 6)),
    ver: { maj: bytes[10] & 0xFF, min: bytes[11] & 0xFF },
    pub: bytes[32] === 0x01,
  }) as ZmqGreet;
}

/** Encode the initial greeting packet. */
export function zmqEncodeGreet (opts?: Partial<ZmqGreet>) {
  const bytes = new Uint8Array(zmqGreetSize);
  bytes[0] = 0xFF;
  bytes[8] = 0x01;
  bytes[9] = 0x7F;
  bytes[10] = (opts?.ver?.maj ?? 3) & 0xFF;
  bytes[11] = (opts?.ver?.min ?? 0) & 0xFF;
  const mechanism = UTF8.encode(opts?.sec ?? 'NULL');
  bytes.set(mechanism.length < 6 ? mechanism : mechanism.subarray(0, 5), 12);
  if (opts?.pub) bytes[32] = 0x01;
  return bytes;
}

/** Expected minimum frame size. */
export const zmqFrameMinSize = 32;

/** Read and decode a ZeroMQ frame. */
export const zmqReadFrame: Fn<[Read], Async<ZmqFrame>> = pipe(
  readUntilDone, zmqDecodeFrame);

/** Decode a ZeroMQ frame. */
export function zmqDecodeFrame (bytes: Bytes|null = null): ZmqFrame|null {
  if (!bytes) return null;
  const long = zmqFlagLong(bytes);
  const size = Number(parse(bytes)[long ? 'u64' : 'u8'](1));
  const more = zmqFlagMore(bytes);
  const cmd  = zmqFlagCmd(bytes);
  const payloadAt = 1 + (long ? 8 : 1);
  Object.assign(bytes, { size, more, long, cmd, payloadAt });
  if (cmd) {
    const len   = bytes[payloadAt];
    const start = bytes[payloadAt + 1];
    const name  = UTF8.decode(bytes.subarray(start, start + len));
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
  return bytes as ZmqFrame
};

/** Encode a ZeroMQ frame. */
export function zmqEncodeFrame (payload: Uint8Array = new Uint8Array(), {
  len  = payload?.length || 0,
  more = false,
  flag = 0,
  enc  = null,
} = {}) {
  if (more) flag |= zmqFlagMore.mask;
  if (len > 0xFF) {
    flag |= zmqFlagLong.mask;
    enc = writeAdvance(new Uint8Array(1 + 8 + len));
    enc.u8(flag);
    enc.writeUint64(BigInt(len));
  } else {
    enc = writeAdvance(new Uint8Array(1 + 1 + len));
    enc.u8(flag);
    enc.u8(len);
  }
  if (len > 0) enc.writeUint8Array(payload);
  return zmqDecodeFrame(enc.done());
}

/** Encode a `READY` command frame. */
export function zmqEncodeReady (metadata = []) {
  const payloadSize = 1 + zmqReady.length + ((metadata||[])
    .map((v: Bytes, i: number) => v.length + (i % 2 === 0 ? 1 : 4))
    .reduce((a: number, b: number) => a + b, 0));
  const encoder = writeAdvance(new Uint8Array(1 + 1 + payloadSize));
  const { u8, u32, str, done } = encoder;
  u8(zmqFlagCmd.mask);
  u8(payloadSize);
  u8(zmqReady.length);
  str(zmqReady);
  (metadata||[]).forEach((it: string, i: number) => {
    ((i % 2 === 0) ? u8 : u32)(it.length);
    str(it);
  });
  return done();
};
