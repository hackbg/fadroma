// https://github.com/meefik/p2p/blob/59db42553fe46b24c07821ef8e4f184e4eb41427/LICENSE
import { Sender, Receiver } from 'p2p';
import { connect, StringCodec } from 'nats.ws';

export default P2P;

async function P2P ({
  room      = 'fadroma',
  driver    = new P2P.NatsDriver(),
  receiver  = new Receiver({ driver }),
  sender    = new Sender({ driver }),
  root      = document.getElementById('demo'),
  onConnect = (e) => { console.debug('connect', e); root.innerHTML += JSON.stringify(e); },
  onDispose = (e) => { console.debug('dispose', e); root.innerHTML += JSON.stringify(e); },
  onMessage = (e) => { console.debug('message', e); root.innerHTML += JSON.stringify(e); },
  onStream  = (e) => { console.log('stream', e); },
} = {}): Promise<P2P> {
  await driver.open(room);
  receiver.start({ room });
  receiver.addEventListener('connect',         onConnect);
  receiver.addEventListener('dispose',         onDispose);
  receiver.addEventListener('stream',          onStream);
  receiver.addEventListener('channel:message', onMessage);
  const context = { room, driver, receiver, sender };
  return context;
}

interface P2P {
  room:     string,
  driver:   P2P.NatsDriver,
  receiver: Receiver,
  sender:   Sender,
}

namespace P2P {

  // https://github.com/meefik/p2p/blob/59db42553fe46b24c07821ef8e4f184e4eb41427/LICENSE
  //
  const sc = StringCodec();

  const sha256 = async (msg) => {
    const data = new TextEncoder().encode(msg);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const createEncryptionKey = async (secret) => {
    const secretHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(secret),
    );
    return await crypto.subtle.importKey(
      'raw',
      secretHash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  };

  const encrypt = async (payload, cryptoKey) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, payload),
    );
    const data = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    data.set(iv, 0);
    data.set(ciphertext, iv.byteLength);
    return data;
  };

  const decrypt = async (data, cryptoKey) => {
    const iv = data.slice(0, 12);
    const ct = data.slice(12);
    const payload = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ct);
    return payload;
  };

  export class NatsDriver extends Map {
    cryptoKey
    servers
    nc
    constructor({ servers = undefined } = {}) {
      super();
      this.servers = servers || ['wss://demo.nats.io:8443'];
    }

    async open(secret) {
      this.nc = await connect({ servers: this.servers, noEcho: true });
      if (secret) {
        this.cryptoKey = await createEncryptionKey(secret);
      }
    }

    async close() {
      await this.nc.drain();
    }

    async on(namespace, handler) {
      const ns = await sha256(namespace.join(':'));
      const sub = this.nc.subscribe(ns, {
        callback: async (err, msg) => {
          if (err) {
            console.error(err);
            return;
          }
          let data = msg.data;
          if (this.cryptoKey) {
            data = await decrypt(data, this.cryptoKey);
          }
          const payload = JSON.parse(sc.decode(data));
          handler(payload);
        },
      });
      if (!this.has(ns)) {
        this.set(ns, new Map());
      }
      this.get(ns).set(handler, sub);
    }

    async off(namespace, handler) {
      const ns = await sha256(namespace.join(':'));
      const sub = this.get(ns)?.get(handler);
      if (sub) {
        sub.unsubscribe();
        this.get(ns).delete(handler);
      }
      if (!this.get(ns)?.size) {
        this.delete(ns);
      }
    }

    async emit(namespace, message) {
      const ns = await sha256(namespace.join(':'));
      if (this.nc) {
        let data = sc.encode(JSON.stringify(message));
        if (this.cryptoKey) {
          data = await encrypt(data, this.cryptoKey);
        }
        this.nc.publish(ns, data);
      }
    }
  }
}
