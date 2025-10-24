/// Based on code by @jjeffcaii (originally published under Apache License 2.0).
/// See https://github.com/jjeffcaii/deno-zeromq/blob/master/LICENSE.
import type { Fn, Step, AsyncIter, Log, Net, Route, Handler, Bytes, Async } from '../index.ts';
import type { Socket } from '../deps.ts';
import { BufReader, BufWriter, log, connect } from "../deps.ts";
import { EOFError } from "../errors.ts";
import { ZmqGreet } from "../proto/mod.ts";
import { TcpServer, HttpServer, createConnection } from '../deps.ts';
import { UTF8, flag, parse } from '../format.ts';
import { todo, pipe, reflect, asyncIter, withCatcher } from '../call.ts';

export type ZmqSocketType  = 'SUB'; // others are unsupported
export type MessageLike = Uint8Array | string;

const zmqFlagMore    = flag('more',    0);
const zmqFlagLong    = flag('long',    1);
const zmqFlagCommand = flag('command', 2);

const EMPTY_MORE = zmqFrame(new Uint8Array([1, 0]));

export type ZmqSubscription = {
  transport: unknown;
  connection: ZmqConnection;
  socketType: ZmqSocketType;
  receive (): Promise<ZmqFrame[]>;
  subscribe (topic: string): Promise<void>;
  send (...msgs: MessageLike[]): Promise<void>;
};

export type ZmqConnection =
  AsyncIter<ZmqFrame> & ZmqClose & ZmqWrite & ZmqRead & {
    tags: Set<string>,
    peekSig (): Promise<Uint8Array>;
    peekVer (): Promise<number>;
    readGreet (): Promise<ZmqGreet>;
    readFrame (): Promise<ZmqFrame>;
  };

export type ZmqFrame = {
  size: number;
  more: boolean;
  long: boolean;
  cmd:  boolean;
} & Bytes;

export type ZmqClose = { close (): void
                       ; onClose (fn: Fn): void };

export type ZmqWrite = { flush (): Promise<void>
                       ; write (message: Bytes): Promise<number> };

export type ZmqRead  = { tryPeek (n: number): Promise<Uint8Array>
                       ; tryRead (n: number): Promise<Uint8Array> };

export const zmqSub = (...handlers: Fn<[ZmqSubscription]>[]) =>
  reflect(null, async function zmqSubscribe ({
    hostname  = 'localhost',
    port      = null as number,
    transport = null as unknown,
  } = {}): Promise<ZmqSubscription> {
    const socketType = 'SUB';
    const connection = zmqConnect({
      transport: await (transport ??= connect({ transport: 'tcp', port, hostname }))
    });
    await handshake(connection, socketType);
    return asyncIter(zmqSubIter)({
      socketType, transport, connection, 
      async subscribe (topicName: string) {
        const topic = UTF8.encode(topicName) as Uint8Array;
        const body = new Uint8Array(topic.length + 1);
        body[0] = 0x01;
        body.set(topic, 1);
        await connection.write(zmqBuildFrame({ body }));
        await connection.flush();
      },
      async send (...msgs: MessageLike[]): Promise<void> {
        await connection.write(EMPTY_MORE);
        await sendMessages(connection, ...msgs);
      },
      async receive (): Promise<ZmqFrame[]> {
        const res = [];
        for (let frame: ZmqFrame;
          (frame = await connection.readFrame())?.more;
          (frame.size > 0) && res.push(zmqFrame(frame)));
        return res;
      }
    });
  }, { handlers });

const zmqSubIter = ({
  connection,
  toPayload = (frame: ZmqFrame, offset = 1): Uint8Array => {
    const { buf, u8, u64 } = parse(frame);
    const n = frame.long ? Number(u64(offset)) : u8(offset);
    offset += frame.long ? 4 : 1;
    return buf(n, offset);
  }
}) => async function * zmqSubIterator (): AsyncIterableIterator<MessageLike[]> {
  let messages: MessageLike[] = [];
  for await (const x of connection) {
    const frame = zmqFrame(x.bytes());
    if (frame.more || frame.size > 0) {
      messages.push(toPayload(frame))
      yield messages;
      messages = []; } } };

export function zmqConnect ({
  error     = console.error,
  transport = null as unknown,
  reader    = { peek: todo(), readFull: todo() },
  writer    = { write: todo(), flush: todo() },
  tags      = new Set() as Set<string>,
  closers   = [] as Fn[],
  signature = null,
  version   = null,
}): ZmqConnection {
  const onClose    = (f: Fn) => closers.push(f);
  const runCloser  = (f: Fn) => { try { f(); } catch (e) { error(e) }; return null; };
  const runClosers = () => { closers = closers.map(runCloser).filter(Boolean); };
  const close      = () => { runClosers(); transport.close() };
  const rethrown   = withCatcher((e: unknown) => { close(); throw e });
  const piped      = <T>(x: T, ...f: Step<[T]>[]) => Promise.resolve(x).then(pipe(...f));
  const write      = (msg: Bytes) => rethrown(writer.write(msg));
  const flush      = () => writer.flush();
  const peek       = (n: number): Promise<Bytes> => reader.peek(n);
  const tryPeek    = rethrown(peek);
  const peekSig    = async () => signature ??=  await tryPeek(10);
  const peekVer    = async () => version   ??= (await tryPeek(11))[10];
  const read       = (n: number): Promise<Bytes> => reader.readFull(n);
  const tryRead    = rethrown(read);
  const readGreet  = async () => tryRead(ZmqGreet.SIZE, (x: Bytes) => new ZmqGreet(x));
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
    return zmqFrame(await reader.readFull(body));
  });

  return asyncIter(zmqConnectionIter)({
    tags,
    close, onClose,
    tryPeek, peekSig, peekVer,
    tryRead, readGreet, readFrame,
    write, flush,
  });
}
const zmqConnectionIter = ({ readFrame }) =>
  async function * iter (): AsyncIterableIterator<Frame> {
    for (;;) { try { yield await readFrame(); } catch (e) { this.notifyClose(); throw e; } }
  };
async function handshake (connection: ZmqConnection, socketType) {
  const { readGreet, readFrame, write, flush } = connection;
  await write(ZmqGreet.builder().build());
  await flush();
  const greeting = await readGreet();
  log.debug(`RCV: greeting=${greeting}`);
  const first = await readFrame() as Frame;
  if (!first.cmd) throw new Error("handshake failed!");
  const cmd = asCommandFrame(first);
  if (cmd.name !== 'ready') throw new Error("handshake failed!");
  const ready = asReadyCommandFrame(first);
  log.debug(`RCV: ready=${ready}`);
  await write(toReadyCommandFrame(socketType));
  await flush();
}
function toReadyCommandFrame (socketType, identity = "") {}
function zmqFrame (bytes: Bytes): ZmqFrame {
  if (bytes === null) return bytes;
  const long          = zmqFlagLong(bytes);
  const size          = Number(parse(bytes)[long ? 'u64' : 'u8'](1));
  const payloadOffset = 1 + (long ? 8 : 1);
  const more          = zmqFlagMore(bytes);
  const cmd           = zmqFlagCommand(bytes);
  return Object.assign(bytes, { size, more, long, cmd });
}
function zmqBuildFrame ({
  body = new Uint8Array(),
  len  = body?.len || 0,
  more = false,
  flag = 0,
  enc  = null,
} = {}) {
  if (more) flag |= zmqFlagMore.mask;
  if (len > 0xFF) {
    flag |= zmqFlagLong.mask;
    enc = new Encoder(1 + 8 + len);
    enc.writeByte(flag);
    enc.writeUint64(BigInt(len));
  } else {
    enc = new Encoder(1 + 1 + len);
    enc.writeByte(flag);
    enc.writeByte(len);
  }
  if (len > 0) {
    enc.writeUint8Array(body);
  }
  return zmqFrame(enc.freeze());
};

export const zmqServerSocket = ({
  socketType  = null as ZmqSocketType,
  onConnect   = _ => {},
  connections = new Set(),
  validateSignature = (_: Uint8Array): boolean => true,
}) => ({
  validateSignature,
  handleConn: async (connection: ZmqConnection): Promise<void> => {
    const { close, onClose, write, flush
          , peekSig, peekVer, readGreet, readFrame } = connection;
    onClose(() => connections.delete(connection));
    connections.add(connection);
    if (!validateSignature(await peekSig())) { close(); return; }
    log.debug(`RCV: sig`);
    const greetingReply = zmqBuildGreet();
    await write(greetingReply.bytes());
    await flush();
    const major = await peekVer();
    log.debug(`RCV: version.major=${major}`);
    const greeting = await readGreet();
    log.debug(`RCV: greeting=${greeting}`);
    const ready = zmqBuildReady(socketType)ReadyCommandFrame.builder().set(METADATA_KEY_SOCKET_TYPE, this.socketType).build();
    await write(ready);
    await flush();
    const first = await readFrame();
    if (first.type !== FrameType.Command) throw new Error("Require ready command!");
    const cmd = new CommandFrame(first.bytes());
    if (cmd.name !== CommandName.Ready) throw new Error("Require ready command!");
    const rcvReady = new ReadyCommandFrame(first.bytes());
    log.debug(`RCV: ready=${rcvReady}`);
    onConnect(conn);
  },
  async bind (addr: string): Promise<void> {
    if (this.#transport) throw new Error("bind already!");
    const tp = bind(addr);
    this.#transport = tp;
    await tp.bind();
    (async () => {
      for await (const conn of tp) {
        this.handleConn(conn);
      }
    })();
  }
})
