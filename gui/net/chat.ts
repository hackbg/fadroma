// https://github.com/meefik/p2p/blob/59db42553fe46b24c07821ef8e4f184e4eb41427/LICENSE
import { Sender, Receiver } from 'p2p';
import { NatsDriver } from './nats.js';
export default P2P;
export async function P2P ({
  room      = 'fadroma',
  driver    = new NatsDriver(),
  receiver  = new Receiver({ driver }),
  sender    = new Sender({ driver }),
  onConnect = (e) => { console.log('connect', e); },
  onDispose = (e) => { console.log('dispose', e); },
  onStream  = (e) => { console.log('stream', e); },
  onMessage = (e) => { console.log('channel:message', e); },
} = {}): Promise<P2P> {
  await driver.open(room);
  receiver.start({ room });
  receiver.addEventListener('connect',         onConnect);
  receiver.addEventListener('dispose',         onDispose);
  receiver.addEventListener('stream',          onStream);
  receiver.addEventListener('channel:message', onMessage);
  const context = { room, driver, receiver, sender };
  console.log({ context });
  return context;
}
export interface P2P {
  room:     string,
  driver:   NatsDriver,
  receiver: Receiver,
  sender:   Sender,
}
