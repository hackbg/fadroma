/** Wrap a SimplicityHL program as a standalone Deno executable. */
//function SimfTS (source: string) {
  //return `#!/usr/bin/env -S deno run -P default\nimport { SimplicityHL } from 'fadroma';\n` +
    //`export default await SimplicityHL.Program(\`${source}\`).cli(import.meta)`;
//}
  //export const Hex = (id: string, ...content: unknown[]) =>
    //Html([`div.field.file.hex#${id}`,
      //['div.handle-v', { onclick: Field.toggle(id) },
        //['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
        //['div.grow']],
      //['div.flex.col.grow',
        //['div.flex.row',
          //['div.name',     { onclick: Field.toggle(id) }, id],
          //['div.handle-h', { onclick: Field.toggle(id) }]],
        //HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        //HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        //HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        //HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

  //export const HexRow = (addr, bytes, chars) => ['div.row.hex-row', addr, bytes, chars];

//}

//export function Program (id: string, ...content: string[]) {
  //return Field(id)
    //.header(Button.Command('play', 'Compile', { onclick: e => Program.recompile(id, e) }))
    //.header(Button.Command('circle-with-plus', 'Define'))
    //.content(Field.TextArea(id, ...content))
    //.content([`div.row#result:${id}`, ['div.grow']])
    //.content([`div.row.simf-result`, ['strong', `P2TR: `],
      //[`div.grow#commit:${id}`, `(not compiled)`],
      //['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]])
    //.content([`div.row.simf-result`, ['strong.w', `Sighash: `],
        //[`div.grow#cmr:${id}`, `(not generated)`],
        //['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]])
    //.sidebar(['div.col.simf-sidebar', 'Sidebar'])
    //.build();
//}
  //export const OracleForm = () => Witness("oracle.wit", 
    //WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
    //WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
    //WitnessRow('sig', 'ORACLE_SIG',    ''),
    //WitnessRow('sig', 'OWNER_SIG',     ''));

  //export const OracleTS = ({ deno, node }) => ES("oracle.ts",
    //ES.HashBang({ deno, node }),
    //ES.Import("@hackbg/fadroma", simf && 'Simf'),
    //simf && `export default Simf(import.meta, "src/main.simf");`);

  //export const Witness = (id: string, ...content: unknown[]) => Field(id).open(false)
    //.header(['select', ['option', 'src/main.simf']])
    //.header(Button.Command('play', 'Satisfy', { onclick: e => recompileSimplictyHL(id, e) }))
    //.content([['div.col.collapsible',
      //WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      //WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      //WitnessRow('sig', 'ORACLE_SIG',    ''),
      //WitnessRow('sig', 'OWNER_SIG',     ''),
      //['div.row', ['div.grow'], Button.Command('circle-with-plus', 'Witness')]]])
    //.build();

  //export const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    //['div.witness',
      //['input[type=text].grow', { value: k, placeholder: 'name' }],
      //['label', ['select', ['option', { value: t }, t]]],
      //['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      //Button.Command('circle-with-cross', 'Remove')];

  //export const SimfFn = (name: string, ...content: unknown[]) =>
    //['div.col.fn',
      //['div.row.align-center',
        //['strong.keyword', 'fn '],
        //[`input[type=text][size=${name.length-2}]`, { value: name }],
        //'(', [`input[type=text][size=2]`], ')',
        //' { ',
        //['div.grow'],
        //Button.Command('circle-with-cross', 'Remove')],
      //['textarea', content.join('\n')||' '], '}'];


  //export const HodlVault = () => Simf("vault.simf", `[>* HODL VAULT: Lock your coins until the Bitcoin price exceeds a threshold.
 //* - Oracle signs message with current block height and current Bitcoin price.
 //* - Block height compared with a minimum height to prevent use of old data.
 //* - TX is timelocked to oracle height, so it only becomes valid after the oracle height. */

//fn checksigfromstack (pk: Pubkey, bytes: [u32; 2], sig: Signature) {
    //let [word1, word2]: [u32; 2] = bytes;
    //let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
    //let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    //jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
//}

//fn main () {
    //let oracle_height: Height = witness::ORACLE_HEIGHT;
    //jet::check_lock_height(oracle_height);

    //let min_height: Height = param::MIN_HEIGHT;
    //assert!(jet::le_32(min_height, oracle_height));

    //let oracle_price: u32 = witness::ORACLE_PRICE;
    //let target_price: u32 = param::TARGET_PRICE;
    //assert!(jet::le_32(target_price, oracle_price));

    //checksigfromstack(param::ORACLE, [oracle_height, oracle_price], witness::ORACLE);
    //let [word1, word2]: [u32; 2] = bytes;
    //let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
    //let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    //jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
    //jet::bip_0340_verify((param::OWNER, jet::sig_all_hash()), witness:OWNER);
//}`)

//import { Sender, Receiver }           from 'npm:p2p';
//import { connect, StringCodec }       from 'npm:nats.ws';

//async function P2P ({
  //room      = 'fadroma',
  //name      = 'unnamed',
  //driver    = new P2P.NatsDriver(),
  //receiver  = new Receiver({ driver }),
  //sender    = new Sender({ driver }),
  //root      = document.getElementById('identities'),
  //onConnect = (e: unknown) => { console.debug('connect', e); root.innerText += JSON.stringify([e.name, e.detail]); },
  //onDispose = (e: unknown) => { console.debug('dispose', e); root.innerText += JSON.stringify([e.name, e.detail]); },
  //onMessage = (e: unknown) => { console.debug('message', e); root.innerText += JSON.stringify([e.name, e.detail]); },
  //onStream  = (e: unknown) => { console.log('stream', e); },
//} = {}): Promise<P2P> {
  //await driver.open(room);
  //receiver.start({ room });
  //receiver.addEventListener('stream',  onStream);
  //receiver.addEventListener('connect', onConnect);
  //receiver.addEventListener('dispose', onDispose);
  //receiver.addEventListener('channel:message', onMessage);
  //sender.start({ room, channels: { chat: { ordered: true }, }, metadata: { pid: `${+ new Date()}`, nickname: name }, });
  //const context = { room, driver, receiver, sender, send };
  //return context;
  //function send (message: unknown) {
    //console.log('send', name, message, sender.connections);
    //sender.connections.forEach((conn) => {
      //console.log('send', name, message, conn);
      //const channel = conn.channels.get('chat');
      //if (channel && channel.readyState === 'open') {
        //channel.send({ name, message });
      //}
    //});
  //}
//}

//interface P2P {
  //room:     string,
  //driver:   P2P.NatsDriver,
  //receiver: Receiver,
  //sender:   Sender,
//}

//namespace P2P {
  //// https://github.com/meefik/p2p/blob/59db42553fe46b24c07821ef8e4f184e4eb41427/LICENSE

  //const sc = StringCodec();

  //const sha256 = async (msg) => {
    //const data = new TextEncoder().encode(msg);
    //const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    //return Array.from(new Uint8Array(hashBuffer))
      //.map(b => b.toString(16).padStart(2, '0'))
      //.join('');
  //};

  //const createEncryptionKey = async (secret) => {
    //const secretHash = await crypto.subtle.digest(
      //'SHA-256',
      //new TextEncoder().encode(secret),
    //);
    //return await crypto.subtle.importKey(
      //'raw',
      //secretHash,
      //{ name: 'AES-GCM' },
      //false,
      //['encrypt', 'decrypt'],
    //);
  //};

  //const encrypt = async (payload, cryptoKey) => {
    //const iv = crypto.getRandomValues(new Uint8Array(12));
    //const ciphertext = new Uint8Array(
      //await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, payload),
    //);
    //const data = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    //data.set(iv, 0);
    //data.set(ciphertext, iv.byteLength);
    //return data;
  //};

  //const decrypt = async (data, cryptoKey) => {
    //const iv = data.slice(0, 12);
    //const ct = data.slice(12);
    //const payload = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ct);
    //return payload;
  //};

  //export class NatsDriver extends Map {
    //cryptoKey
    //servers
    //nc
    //constructor({ servers = undefined } = {}) {
      //super();
      //this.servers = servers || ['wss://demo.nats.io:8443'];
    //}

    //async open(secret) {
      //this.nc = await connect({ servers: this.servers, noEcho: true });
      //if (secret) {
        //this.cryptoKey = await createEncryptionKey(secret);
      //}
    //}

    //async close() {
      //await this.nc.drain();
    //}

    //async on(namespace, handler) {
      //const ns = await sha256(namespace.join(':'));
      //const sub = this.nc.subscribe(ns, {
        //callback: async (err, msg) => {
          //if (err) {
            //console.error(err);
            //return;
          //}
          //let data = msg.data;
          //if (this.cryptoKey) {
            //data = await decrypt(data, this.cryptoKey);
          //}
          //const payload = JSON.parse(sc.decode(data));
          //handler(payload);
        //},
      //});
      //if (!this.has(ns)) {
        //this.set(ns, new Map());
      //}
      //this.get(ns).set(handler, sub);
    //}

    //async off(namespace, handler) {
      //const ns = await sha256(namespace.join(':'));
      //const sub = this.get(ns)?.get(handler);
      //if (sub) {
        //sub.unsubscribe();
        //this.get(ns).delete(handler);
      //}
      //if (!this.get(ns)?.size) {
        //this.delete(ns);
      //}
    //}

    //async emit(namespace, message) {
      //const ns = await sha256(namespace.join(':'));
      //if (this.nc) {
        //let data = sc.encode(JSON.stringify(message));
        //if (this.cryptoKey) {
          //data = await encrypt(data, this.cryptoKey);
        //}
        //this.nc.publish(ns, data);
      //}
    //}
  //}
//}

//export async function Nav () {
  //Html.on(Html.id("navbar"), "click", navigate);
  //Html.on(document.body, "click", ({ target }) => {
    //while (target !== document.body) {
      ////console.log(...target.classList)
      //if (target.classList.contains('scroll-to')) {
        //const y = target.offsetTop - 100;
        //if (window.scrollY < y) scrollTo(Math.max(0, y));
        ////console.log(target.offsetHeight, target.offsetTop, window.innerHeight, window.scrollY);
        //break;
      //}
      //target = target.parentElement
    //}
  //})
//}

//async function navigate (e: Event) {
  //let target = e.target as HTMLElement;
  //do {
    //if (target.dataset.action) switch (target.dataset.action) {
      //case 'new':  e.preventDefault(); return Editor();
      //case 'load': e.preventDefault(); return Editor.load();
      //case 'save': e.preventDefault(); return Editor.save();
      //case 'docs': e.preventDefault(); return loadDocs("/docs/deno/index.html");
      //default: return;
    //}
    //target = target.parentElement;
  //} while (target && target !== e.currentTarget);
//}

//function loadRepository ({
  //view: _1 = null as DocumentFragment,
  //url:  _2 = null as string|URL,
//} = {}) {
  //[> TODO <]
//}
