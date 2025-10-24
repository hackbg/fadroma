/// Based on code by @jjeffcaii (originally published under Apache License 2.0).
/// See https://github.com/jjeffcaii/deno-zeromq/blob/master/LICENSE.
import type { Fn, AsyncIter, Log, Bytes, Async } from '../index.ts';
import { connect, setImmediate } from "../deps.ts";
import { UTF8, flag, parse, writeAdvance } from '../format.ts';
import { call, todo, reflect, asyncIter, withCatcher } from '../call.ts';
import { logger } from '../logger.ts';
import { suite, expect, equal } from '../tester.ts';
import { Error } from '../format/error.ts';

const testZmqDecodeFrame = () => {
  equal(zmqFrameDecode(), null);
  const b = new Uint8Array(64);
  equal(zmqFrameDecode(b), b);
};
const testZmqDecodeCmd = () => {
  equal(zmqCmdDecode(null), null);
  const b = new Uint8Array(64);
  equal(zmqCmdDecode(b), b);
};
const testZmqDecodeReady = () => {
  equal(zmqReadyDecode(null), null);
  const b = new Uint8Array(64);
  equal(zmqReadyDecode(b), b);
};
export default suite(import.meta, 'ZeroMQ',
  expect('Frame',
    expect('Decode', testZmqDecodeFrame,
      expect('Command', testZmqDecodeCmd,
        expect('Ready', testZmqDecodeReady))),
    expect('Encode', () => {
      equal(zmqFrameEncode(), null);
    })));

export const zmqCmdReady  = 'READY';
export const zmqFlagMore  = flag('MORE', 0);
export const zmqFlagLong  = flag('LONG', 1);
export const zmqFlagCmd   = flag('CMD',  2);
export const zmqEmptyMore = zmqFrameDecode(new Uint8Array([1, 0]));
export const zmqGreetSize = 64;

export type ZmqSec        = 'NULL'|'PLAIN'|'CURVE';
export type ZmqGreet      = { sig, sec, ver, pub };
export type ZmqSocketType = 'PUB'|'SUB'; // others are unsupported
export type ZmqCmd        = ZmqFrame & { name: string };
export type ZmqReady      = ZmqCmd & { metadata: string [] };
export type ZmqFrame = Bytes & { size: number
                               ; more: boolean
                               ; long: boolean
                               ; cmd:  boolean
                               ; payloadOffset: number; };

export function zmqFrameDecode (bytes: Bytes|null = null): ZmqFrame|null {
  if (!bytes) return null;
  const long = zmqFlagLong(bytes);
  const size = Number(parse(bytes)[long ? 'u64' : 'u8'](1));
  const more = zmqFlagMore(bytes);
  const cmd  = zmqFlagCmd(bytes);
  const payloadOffset = 1 + (long ? 8 : 1);
  return Object.assign(bytes, { size, more, long, cmd, payloadOffset });
};

export function zmqFrameEncode (payload: Uint8Array = new Uint8Array(), {
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
  return zmqFrameDecode(enc.done());
}

export function zmqCmdDecode (bytes: Bytes): ZmqCmd {
  const frame = zmqFrameDecode(bytes) as ZmqCmd;
  if (!frame?.cmd) throw new Error('not a command frame', { frame });
  if (frame.name) return frame as ZmqCmd;
  let offset = frame.payloadOffset;
  const commandNameSize = frame[offset];
  offset++;
  const name = UTF8.decode(frame.subarray(offset, offset + commandNameSize));
  return Object.assign(frame, { name }) as ZmqCmd;
}

export function zmqReadyDecode (bytes: Bytes): ZmqReady {
  const frame = zmqCmdDecode(bytes) as ZmqReady;
  if (frame?.name !== zmqCmdReady) throw new Error('not a ready command', { frame });
  const offset = frame.payloadOffset + 1 + zmqCmdReady.length;
  const metadata = [];
  const { u8, u32, str } = parse(frame);
  for (let cursor = offset; cursor < frame.length;) {
    const n = (metadata.length % 2 === 0) ? u8(cursor) : u32(cursor);
    cursor += (metadata.length % 2 === 0) ? 1 : 4;
    metadata.push(str(n, cursor));
    cursor += n;
  }
  return Object.assign(frame, { metadata }) as ZmqReady;
}

export type ZmqConnection = Log & AsyncIter<ZmqFrame> & {
  tags: Set<string>;
  close (): void; onClose (fn: Fn): void;
  flush (): Promise<void>; write (message: Bytes): Promise<number>;

  tryPeek (n: number): Promise<Uint8Array>;
  peekSig (): Promise<Uint8Array>;
  peekVer (): Promise<number>;

  tryRead (n: number): Promise<Uint8Array>;
  readGreet (): Promise<ZmqGreet>;
  readFrame (): Promise<ZmqFrame>;
};

const zmqConnIter = ({ readFrame }) =>
  async function * iter (): AsyncIterableIterator<ZmqFrame> {
    for (;;) { try { yield await readFrame(); } catch (e) { this.notifyClose(); throw e; } }
  };

export function zmqGreetDecode (bytes: Bytes) {
  return Object.assign(bytes, {
    sig: bytes.subarray(0, 10),
    sec: UTF8.decode(bytes.subarray(12, 6)),
    ver: { maj: bytes[10] & 0xFF, min: bytes[11] & 0xFF },
    pub: bytes[32] === 0x01,
  });
}

function zmqGreetMech (bytes: Bytes) {
  let end = 17;
  for (let i = 1; i <= 5; i++) { if (bytes[17 - i] !== 0x00) break; end--; }
  return bytes.subarray(12, end);
}

export function zmqGreetEncode ({
  maj = 3, min = 0, pub = false, sec = 'NULL' as ZmqSec
} = {}) {
  const bytes = new Uint8Array(zmqGreetSize);
  bytes[0] = 0xFF;
  bytes[8] = 0x01;
  bytes[9] = 0x7F;
  bytes[10] = maj & 0xFF;
  bytes[11] = min & 0xFF;
  const mechanism = UTF8.encode(sec);
  bytes.set(mechanism.length < 6 ? mechanism : mechanism.subarray(0, 5), 12);
  if (pub) bytes[32] = 0x01;
  return Object.assign(bytes, {
    sig: bytes.subarray(0, 10),
    sec: UTF8.decode(mechanism),
    pub, ver: { maj, min },
  });
}

export function zmqReadyEncode ({
  metadata = [],
  payloadSize = 1 + zmqCmdReady.length + (metadata
    .map((v: Bytes, i: number) => v.length + (i % 2 === 0 ? 1 : 4))
    .reduce((a: number, b: number) => a + b, 0)),
  encoder = writeAdvance(new Uint8Array(1 + 1 + payloadSize)),
}) {
  const { u8, u32, str, done } = encoder;
  u8(zmqFlagCmd.mask);
  u8(payloadSize);
  u8(zmqCmdReady.length);
  str(zmqCmdReady);
  const meta = (it: string, i: number) => { ((i % 2 === 0) ? u8 : u32)(it.length); str(it); };
  metadata.forEach(meta);
  return done();
};

export type ZmqSubscription = Log & {
  transport: unknown;
  connection: ZmqConnection;
  socketType: ZmqSocketType;
  receive (): Promise<ZmqFrame[]>;
  subscribe (topic: string): Promise<void>;
  send (...msgs: Bytes[]): Promise<void>;
};

const zmqSubIter = ({
  connection,
  toPayload = (frame: ZmqFrame, offset = 1): Uint8Array => {
    const { buf, u8, u64 } = parse(frame);
    const n = frame.long ? Number(u64(offset)) : u8(offset);
    offset += frame.long ? 4 : 1;
    return buf(n, offset);
  }
}) => async function * zmqSubIterator (): AsyncIterableIterator<Bytes[]> {
  let messages: Bytes[] = [];
  for await (const x of connection) {
    const frame = zmqFrameDecode(x.bytes());
    if (frame.more || frame.size > 0) {
      messages.push(toPayload(frame));
      yield messages;
      messages = [];
    }
  }
};

export function zmqConnect (...args): ZmqConnection {
  const {
    debug     = console.debug,
    error     = console.error,
    transport = null as { close: Fn },
    reader    = { peek: todo(), readFull: todo() },
    writer    = { write: todo(), flush: todo() },
    close     = () => { closers.forEach(runCloser); closers.length = 0; return transport.close(); },
    closers   = [] as Fn[],
    runCloser = (f: Fn) => { try { f(); } catch (e) { error(e) }; return null; },
    tags      = new Set() as Set<string>,
  } = Object.assign(logger(), ...args);
  const rethrown = withCatcher((e: unknown) => { close(); throw e });
  const peek     = (n: number): Promise<Bytes> => reader.peek(n);
  const tryPeek  = rethrown(peek);
  const peekSig  = () => tryPeek(10);
  const peekVer  = async () => {
    const version = (await tryPeek(11))[10];
    debug(version);
    return version
  };
  const read      = (n: number): Promise<Bytes> => reader.readFull(n);
  const tryRead   = rethrown(read);
  const readGreet = () => tryRead(zmqGreetSize)
    .then((x: Bytes) => zmqGreetDecode(x))
    .then((x: ZmqGreet) => { debug(`RCV: greeting=${x}`); return x });
  const readFrame  = rethrown(async () => {
    const [flags, long] = await tryPeek(2) || [null, null];
    if (flags === null) return null;
    let size = 1;
    if (!zmqFlagLong(flags)) {
      const length = await reader.peek(10);
      if (length === null) return null;
      size += 8 + Number(new DataView(length.buffer).getBigUint64(2));
    } else {
      size += 1 + long;
    }
    const body = new Uint8Array(size);
    return zmqFrameDecode(await reader.readFull(body));
  });

  return asyncIter(zmqConnIter)({
    tags,
    close, onClose: (f: Fn) => closers.push(f),
    tryPeek, peekSig, peekVer,
    tryRead, readGreet, readFrame,
    write: (msg: Bytes) => rethrown(writer.write(msg)),
    flush: () => writer.flush(),
  });
}

export function zmqSub (...handlers: Fn<[ZmqSubscription]>[]) {
  return reflect(null, async function zmqSubscribe ({
    hostname  = 'localhost',
    port      = null as number,
    transport = null as unknown,
  } = {}): Promise<ZmqSubscription> {
    const connection = zmqConnect({ transport: await (transport ??= connect({ transport: 'tcp', port, hostname })) });
    await zmqSubShake(connection);
    const { readFrame, write, flush } = connection;
    return asyncIter(zmqSubIter)({
      transport,
      connection, 
      async subscribe (topicName: string) {
        const topic = UTF8.encode(topicName) as Uint8Array;
        const payload = new Uint8Array(topic.length + 1);
        payload[0] = 0x01;
        payload.set(topic, 1);
        await write(zmqFrameEncode(payload));
        await flush();
      },
      async send (...msgs: Bytes[]): Promise<void> {
        await write(zmqEmptyMore);
        if (msgs.length > 0) {
          await write(encodeMessages(...msgs));
        }
        await flush();
      },
      async receive (): Promise<ZmqFrame[]> {
        const res = [];
        for (let frame: ZmqFrame;
          (frame = await readFrame())?.more;
          (frame.size > 0) && res.push(zmqFrameDecode(frame)));
        return res;
      }
    });
  }, { handlers });
}

export const encodeMessages = (...messages: MessageLike[]): Uint8Array => {
  const b = [];
  // write head
  for (let i = 0; i < messages.length - 1; i++) {
    const next = zmqFrameEncode(messages[i], { more: true });
    b.push(next.bytes());
  }
  // write last
  const tail = DataFrame.builder().payload(messages[messages.length - 1])
    .build();
  b.push(tail.bytes());
  return bytes.concat(...b);
};


export async function zmqSubShake (
  connection: ZmqConnection
): Promise<ZmqConnection> {
  const { readGreet, readFrame, write, flush } = connection;
  await write(zmqGreetEncode({ pub: false })); await flush();
  await readGreet();
  const { metadata } = zmqReadyDecode(await readFrame());
  await write(zmqReadyEncode({ metadata })); await flush();
  return connection;
}

export async function zmqPubShake <T> (
  connection: ZmqConnection,
  { onConnect = (_: unknown): Async<T> => todo()() } = {}
): Promise<T> {
  const { write, flush, peekVer, readGreet, readFrame } = connection;
  await write(zmqGreetEncode({ pub: true })); await flush();
  await peekVer();
  await readGreet();
  await write(zmqReadyEncode({})); await flush();
  return onConnect(zmqReadyDecode(await readFrame()));
}

export const zmqPubSocket = ({
  connections = new Set(),
  validateSignature = (_: Uint8Array): boolean => true,
}) => ({
  validateSignature,
  async connected (connection: ZmqConnection): Promise<ZmqConnection> {
    const { close, onClose, peekSig } = connection;
    onClose(() => connections.delete(connection));
    connections.add(connection);
    if (!validateSignature(await peekSig())) { close(); return; }
    return zmqPubShake(connection);
  }
});

function zmqPubRun (transport, socket) {
  let stopped = false;
  setImmediate(async ()=>{
    for await (const connection of transport) {
      if (stopped) break;
      socket.onConnection(connection);
    }
  });
  return { stop: () => { stopped = true; } };
}
