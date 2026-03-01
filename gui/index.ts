Error.stackTraceLimit = 100

import { Err }            from '../library/Err.ts';
import Html               from '../library/Html.ts';
import type { Bytes, Fn } from '../library/index.ts';
import { Base16 }         from '../library/Number.ts';
import { joinLines }      from '../library/String.ts';

import { Transaction, p2wpkh as P2WPKH } from 'npm:@scure/btc-signer';
import Bitcoin, { Esplora } from '../platform/Bitcoin/Bitcoin.ts';

import * as Monaco                    from 'npm:monaco-editor';
import scrollTo                       from 'npm:animated-scroll-to';
import { Sender, Receiver }           from 'npm:p2p';
import { connect, StringCodec }       from 'npm:nats.ws';
import { pubECDSA }                   from 'npm:@scure/btc-signer/utils.js'; // not already in keypair?
import { zipSync, strToU8 as zipStr } from 'npm:fflate';

import Wasm                           from './wasm.ts';
import { Labels, Texts, Icon }        from './cons.ts';

type App  = ReturnType<typeof App>;
type User = ReturnType<typeof User>;

const chain = Bitcoin.LiquidTestnet(); // Chain handle (initialized once)
const nonSecret = (n: number) => new Uint8Array(new Array(32).fill(n));
const usersByName   = {};

/** Launch the editor and user views. */
export default function App ({
  /** Integrate with Bitcoin ecosystem */
  btc      = true,
  /** Provide Nix shell with project. */
  nix      = true,
  /** Auto-activate Nix shell. */
  direnv   = nix,
  /** Include Elements in Nix shell. */
  elements = nix,
  /** Make the repo a Node.js package. */
  node     = false,
  /** Make the repo a Deno environment. */
  deno     = true,
  /** Host element for chains view */
  chainsView = Html.id("chains"),
  /** Host element for developer view */
  editorView = Html.id("editors"),
  /** Host element for user view */
  usersView  = Html.id("users"),
  /** Example users. */
  users = [addUser('Alice', { secret: nonSecret(1) }),
           addUser('Bob',   { secret: nonSecret(2) }),
           addUser('Carol', { secret: nonSecret(3) })],
} = {}) {
  chainsView.innerHTML = '';
  usersView.innerHTML = '';
  const state = {
    editorView: ErrorBoundary(editorView,
      () => Editor(editorView, { users })), // FIXME: must precede Users to populate pickers
    users: ErrorBoundary(usersView, () => {
      for (const user of users) Html.append(usersView, user.view());
      for (const select of userSelectors()) initUserPicker(select, users);
      return Object.assign(usersView, { users })
    }),
    chainsView:  Chains(chainsView),
    projectView: Html.append(Html.id('identities'), Section(
      { className: 'layer project' },
      ['div.col.grow.files.gap',
        ['div', ['h2', 'Project template:'], Texts.DownloadProject],
        ['div.row.fields',
          ['div.field.head.grow', ['div.name.title', 'Title'], InputTitle()],
          ['div.field.head', ['div.name', 'Licence'], Select.License()],
          ['div.row.fields', ['div.field.head.grow', ['div.name', 'Download']]]],
        ['div.col.gap', Field.Text("README", Texts.README)],
        Field.Text("Justfile", "TODO"),
          ES.TestSuite({ deno, node, btc }),
          ES.DenoJson({ deno }),
          Nix({ nix, elements }),
          direnv && Field.Text(".envrc", "use nix")]))
  };
  return state;
}

const userSelectors = (host = document) =>
  host.querySelectorAll('select.pick-user') as unknown as HTMLSelectElement[];

const addUser = (...[name, options]: Parameters<typeof User>): User => {
  const user = User(name, options);
  user.balance().then(value => console.debug(user, value));
  return user;
}

/** Create and dispay a user card. */
const User = (name: string, {
  secret   = null,
  signer   = Wasm.keypair(secret),
  pubkey   = pubECDSA(secret),
  pubkeyX  = signer.xOnlyPublicKey(),
  signTxIn = (tx: Transaction, index: number) => tx.signIdx(secret, index),
  //chain    = { bech32: 'ert', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, },
  p2wpkh   = P2WPKH(pubkey, { bech32: 'tex', blech32: 'tlq', pubKeyHash: 36, scriptHash: 19, wif: 0xef }),
  output   = Html(['div.log', 'Enter Bob, Carol.']),
  //p2p      = P2P({ name, root: output }),
  toolbar  = Html(['section.progs', ['button.pill', 'Send'], ['button.pill', 'P2PK'], ['button.pill', 'Vault'], ['button.pill', 'Escrow'], ['input.chat', { placeholder: 'chat' }], ['button.pill', 'Say']]),
  identity = Html(['section.meta',  ['div.col.gap', ['div.row.gap.align-center', ['strong.name', name], ['div.col.gap', p2wpkh, ['strong', [`span.balance[balance=${p2wpkh.address}]`, 'Loading balance...']]]]]]),
  //identity = Html`(section.meta (.col.gap (.row.gap.align-center (strong.name ${name}) (.col.gap p2wpkh (strong ${balance})))))`,
  view     = () => Html(['div.col', ['article.user', identity, output, toolbar]]),
  balance  = () => getBalances(p2wpkh.address).then(value => {
    for (const element of document.querySelectorAll(`span[balance=${p2wpkh.address}]`) as unknown as HTMLElement[]) {
      element.innerText = `${value} sats`;
    }
    for (const element of document.querySelectorAll(`input[balance=${p2wpkh.address}]`) as unknown as HTMLInputElement[]) {
      element.value = String(value);
    }
    return value
  })
} = {}) => ({
  name,
  signer,
  p2wpkh,
  view,
  balance,
  signTxIn,
  pubkey:  Base16.encode(pubkey),
  pubkeyX: Base16.encode(pubkeyX)
} as {
  /** Human-friendly name. */
  name: string
  /** Main address of user. */
  p2wpkh: { address: string, script: Bytes }
  /** Public key of user. */
  pubkey: string
  /** X-Only (tweaked?) public key of user. */
  pubkeyX: string
  /** Can sign data with hidden secret key of user. */
  signer: ReturnType<typeof Wasm.keypair>
  /** Render the user card. */
  view (): DocumentFragment
  /** Balance at init. */
  balance (): Promise<bigint>
});

const initUserPicker = (select: HTMLSelectElement, users: User[]) => {
  select.innerHTML = '';
  for (const user of usersToOptions(users)) select.appendChild(user);
  if (select.onchange) select.onchange(null);
};

const usersToOptions = (users = [], value = (user: User) => user.pubkey) => users.map(user=>
  Html(['option', { value: value(user) }, ['strong', user.name], ` (${user.p2wpkh.address})`]).firstChild);

/** Display error thrown by component init in host element. */
const ErrorBoundary = <T, V extends HTMLElement> (errorView: V, callback: () => T) => {
  try {
    return callback()
  } catch (error) {
    console.error(error);
    errorView.style.whiteSpace = 'pre';
    errorView.innerText = error.stack;
  }
}

/** Display error thrown by async component init in host element. */
const ErrorBoundaryAsync = async <T, V extends HTMLElement> (errorView: V, callback: () => Promise<T>) => {
  try {
    return await callback()
  } catch (error) {
    console.error(error);
    errorView.style.whiteSpace = 'pre';
    errorView.innerText = error.stack;
  }
}

/** Chain connection indicator button. */
const Chains = (view = Html.id("chains"), {

  interval = 10000,

  state = { interval, nextUpdate: null, view, heightView: null, statusView: null, hashView: null },

  disabled = (name: string) => ['div.chain.disabled.col.gap',
    ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to ', name],
      ['strong.status', 'SOON']]],

  disableder = (name: string) => ['div.chain.disableder.col.gap',
    ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to ', name],
      ['strong.status', 'SOON']]],

  selected = (name: string) => ['div.chain.active.col.gap',
    ['div.row.gap.align-center.justify-start',
      ['strong.status', chain ? Texts.CONNECTING : Texts.CONNECTED],
      ['h3.name', name], ['div.grow'], ['div.row.gap', ['div', 'Height: '], ['strong.height']]]],

} = {}) => ErrorBoundary(view, ()=>{

  Html.replace(view, state.view = Html(['div.col.gap',
    disabled('Bitcoin Mainnet'),
    disabled('Bitcoin Testnet'),
    disabled('Bitcoin regtest...'),
    disabled('Liquid Mainnet'),
    selected('Liquid Testnet'),
    disabled('Liquid elementsregtest...'),
    ['div.row.gap', disableder('Solana RPC...'), disableder('Tendermint RPC...')]
  ]).firstChild as HTMLElement);

  state.hashView = state.view.querySelector('.chain.active .hash') as HTMLDivElement;
  state.heightView = state.view.querySelector('.chain.active .height') as HTMLDivElement;
  state.statusView = state.view.querySelector('.chain.active .status') as HTMLDivElement;
  state.statusView.style.color = '#af8';
  state.statusView.innerText = Texts.CONNECTED;

  return updateChains(state)

  async function updateChains (state: {
    view:       Node
    statusView: HTMLElement
    heightView: HTMLElement
    hashView:   HTMLElement
    interval:   number
    nextUpdate: ReturnType<typeof setTimeout>
  }) {
    try {
      state.heightView.innerText = String(await chain.esplora.getBlockTipHeight());
    } catch (e) {
      console.error(e);
      state.statusView.innerText = Texts.CONNECT_ERROR;
      state.statusView.style.color = '#f84';
    } finally {
      state.nextUpdate = setTimeout(()=>updateChains(state), state.interval);
    }
    return state
  }

});

const Editor = (host: HTMLElement, {
  users     = [],
  header    = Section({ className: 'layer', }, Texts.SIMPLICITYHL),
  programs  = Section({ className: 'layer programs col' }, examplePrograms({ users })),
  empty     = ['ul.instances', ['div.empty', ['strong', 'No deployed programs!'], ' ', Texts.NO_DEPLOYS]],
  instances = Section({ className: 'phase' }, ['div.row.gap.field.file', empty]),
  amount    = Label('Amount:', Input({ type: 'number' }), { value: '1234' }), // FIXME witness field
  sighash   = InputSigHash(), // FIXME generate
  witness   = ProgramForm('simf-witness', Texts.WitnessTitle, InputBalance(), Select.Recipient(), amount, sighash),
  signer    = Select.Signer({ name: 'witness::SIG' }).view,
  redeemTx  = Label('TX bytes:', Input(), Label('Redeem TX:', Button('redeem'))),
  redeem    = ProgramForm('simf-redeem',  Texts.RedeemTitle, signer, redeemTx),
  consume   = Section({ className: 'phase-form' }, witness, redeem),
} = {}) => {
  host.innerText = '';
  setTimeout(function initEditors () {
    const textareas = host.querySelectorAll('#editor textarea');
    for (const textarea of textareas as unknown as HTMLTextAreaElement[]) {
      initEditor({ textarea: Field.computeHeight(textarea) });
    }
  }, 1);
  return Html.append(host, Html(['div.editors', header, programs, instances]));
}

const initEditor = ({
  textarea = null as  HTMLTextAreaElement & { monaco?: Monaco.editor.ITextModel },
  content  = textarea.value,
  language = textarea.dataset.language ??= 'nix',
  uri      = textarea.dataset.uri ??= `fadroma://${+new Date()}`,
  model    = textarea.monaco = Monaco.editor.createModel(content, language, Monaco.Uri.parse(uri)),
  wrapper  = Html.Div('.editor-wrapper'),
  editor   = Monaco.editor.create(wrapper, monacoOptions(language, model)),
} = {}) => {
  let ignoreEvent = false;
  editor.onDidContentSizeChange(updateHeight);
  updateHeight();
  textarea.parentElement.appendChild(wrapper);
  textarea.parentElement.removeChild(textarea);
  function updateHeight () {
    if (ignoreEvent) return;
    const width  = Math.max(300,  wrapper.offsetWidth);
    const height = Math.min(1000, editor.getContentHeight()) + 1;
    //wrapper.style.width  = `${width}px`;
    wrapper.style.height = `${height}px`;
    try {
      ignoreEvent = true;
      //console.log({width, height});
      editor.layout({ width, height });
    } finally {
      ignoreEvent = false;
    }
  }
}

function monacoOptions (language: string, model: Monaco.editor.ITextModel) {
  return {
    language,
    model,
    overviewRulerLanes:                         0,
    automaticLayout:                            true,
    scrollBeyondLastLine:                       false,
    minimap:                                    { enabled: false },
    wordWrap:                                   'on'       as const,
    wrappingStrategy:                           'advanced' as const,
    scrollbar:                                  {
      horizontal:                               'hidden'   as const,
      vertical:                                 'auto'     as const,
      alwaysConsumeMouseWheel:                  false,
      ignoreHorizontalScrollbarInContentHeight: true,
    },
  }
}

const EditableProgram = async (name: string, source: string) => {
  source = source.split('\n').map((line, index)=>(index > 0)?line.slice(2):line).join('\n');
  const view = ({ users = [], host = document.createElement('div') as HTMLElement } = {}) =>
    Html.replace(host, Html(ProgramEditor({ id: `src/${name}.simf`, source, open: true, users })));
  return { name, source, view }
};

const ProgramEditor = ({
  id,
  source,
  esplora  = chain.esplora,
  open     = false,
  users    = [],
  errors   = Html(['pre.compile-errors.collapsible']).firstChild as HTMLElement,
  params   = Wasm.params(source),
  fields   = Object.entries(params).map(ProgramField({ id, users, kind: 'Parameter: ' })),
  compiler = Wasm.compiler({ chain: chain.ID, genesis: chain.GENESIS }),
  address  = InputP2TR(() => preview()),
  amount   = Input({ className: 'balance', type: 'number', value: '2345' }),
  inputs   = Html(['ul.inputs']).firstChild,
  outputs  = Html(['ul.outputs']).firstChild,
  balance  = InputBalance({ label: ['strong', 'Balance:'], address: users[0]?.p2wpkh.address }),
  sender   = SelectSender({ balance, chain, users, onchange: () => preview() }),
  preview  = TxPreview({ users, esplora, inputs, outputs, amount, address, sender }),
  button   = CompileButton(id, { params, compiler, source, address, errors, preview }),
  stage1   = ProgramForm('simf-compile', ['h3', 'Step 1. Compile program.'], SelectChain(), ...fields, button),
  commit   = CommitButton(id, { users, params, compiler, source, errors, preview, amount, sender: sender.select }),
  title2   = ['label', ['div.row', ['label', ['strong', 'Sender:'], sender.select], balance], sender.utxos],
  stage2   = ProgramForm('simf-commit', ['h3', 'Step 2. Commit funds to address of program.'], title2, commit),
}) => Field(id).open(open).content(TextArea(id, source)).content(errors)
  .sidebar(['div.phase-form', stage1])
  .sidebar(['div.phase-form', stage2])
  .build();

const InputP2TR = (onchange?: Fn) =>
  Input({ onchange, placeholder: 'provide parameters and compile to get P2TR' });

const CommitButton = (id: string, {
  preview  = null,
  errors   = null,
  source   = null,
  amount   = null,
  users    = [],
  params   = {},
  chain    = Bitcoin.LiquidTestnet,
  genesis  = chain.GENESIS, // TODO autofetch from block 0
  compiler = Wasm.compiler({ chain: chain.ID, genesis }),
  button   = Button('commit', () => commit()),
  title    = ['label.align-center.row', Label('Commit amount:', amount), button],
  view     = Html(['label.tx-preview', title, preview.inputs, preview.outputs]).firstChild,
  sender   = null as HTMLInputElement,
  init     = () => Object.assign(view, { commit, }),
  commit   = () => ErrorBoundaryAsync(errors, async () => {
    const args = collectParams(id, params);
    const prog = compiler.compile(source, { args });
    const p2tr = prog.toJSON().p2tr;
    const user = users.find(x=>x.pubkey === sender.value);
    if (!user) throw Err(`not our pubkey: ${user}`);
    const tx = await preview({ user, p2tr });
  })
} = {}) => init();

const Utxo = ({ txid, index }) => ['code', `tx ${txid} out ${index}`];

const Address = ({ address }) => ['input[disabled]', { value: address }];

const Txid = ({ txid }) => ['input[disabled]', { value: txid }];

const Amount = ({ value }) => ['input[disabled]', { style: 'width:12ch; flex-grow: 0', value: String(value) }];

const TxPreview = ({
  users     = [],
  esplora   = null,
  amount    = null,
  address   = null,
  inputs    = null,
  outputs   = null,
  sender    = null,
  network   = { bech32: 'tex', blech32: 'tlq', pubKeyHash: 36, scriptHash: 19, wif: 0xef },
  tx        = new Transaction(),
  addInput  = (name: string, address: string, script: Bytes, txid: string, index: number, value: string|number|bigint) => {
    tx.addInput({ txid, index, witnessUtxo: { amount: BigInt(value), script } });
    if (inputs) Html.append(inputs,
      Html(['li', ['strong', name], Amount({ value }), ' from ', Address({ address })]).firstChild);
  },
  addOutput = (name: string, address: string, value: string|number|bigint) => {
    tx.addOutputAddress(address, BigInt(value), network);
    if (outputs)
      Html.append(outputs, Html(['li', ['strong', name], Amount({ value }), ' to ', Address({ address })]).firstChild);
  },
  addFee    = (name: string, value: string|number|bigint) => {
    //tx.addOutputAddress(addr, BigInt(value), network);
    if (outputs)
      Html.append(outputs, Html(['li', ['strong', name], Amount({ value }), ' to the network ']).firstChild);
  },
  update = async function updateTxPreview ({
    user  = sender?.select?.value,
    p2tr  = address?.value,
    value = amount?.value,
    fee   = 1000,
  } = {}) {
    if (inputs)  inputs.innerHTML  = '';
    if (outputs) outputs.innerHTML = '';
    tx = new Transaction();
    const { address, script } = (users.find(x=>x.pubkey === user)||{}).p2wpkh;
    if (address) {
      const utxos = await esplora.getAddressUtxos(address);
      if (utxos.length < 1) throw Err(`fund the address first: ${address}`);
      const utxo = utxos[0];
      if (p2tr) {
        const utxoValue   = BigInt(utxo.value);
        const sendValue   = BigInt(value);
        const feeValue    = BigInt(fee);
        const changeValue = utxoValue - (sendValue + feeValue);
        addInput('Input: ', address, script, utxo.txid, utxo.vout, utxoValue);
        addOutput('Program: ', p2tr, sendValue);
        if (changeValue !== 0n) addOutput('Change: ', address, changeValue);
        addFee('Fee: ', feeValue);
        if (!user.signTxIn(tx, 0)) throw Err(`failed to sign ${tx.inputs[0]} as ${user.name}`)
        tx.finalize();
      }
    }
    return tx;
  }
}) => {
  update();
  return Object.assign(update, { inputs, outputs });
}

const CompileButton = (id: string, {
  errors   = null,
  source   = null,
  address  = null,
  preview  = null,
  params   = {},
  chain    = Bitcoin.LiquidTestnet,
  genesis  = chain.GENESIS, // TODO autofetch from block 0
  compiler = Wasm.compiler({ chain: chain.ID, genesis }),
  balance  = Input({ disabled: 'disabled' }),
  utxos    = UtxoList({ esplora: chain.esplora }),
  button   = Button('compile', () => compile()),
  label    = ['strong', 'Program address (P2TR):'],
  title    = ['div.row.gap.align-center.justify-between', label, button],
  view     = Html(['label.col.gap.align-stretch', ['label.align-end', title, address], utxos, errors]).firstChild,
  init     = () => Object.assign(view, { compile }),
  compile  = () => ErrorBoundaryAsync(errors, async () => {
    //const { default: Wasm } = await import('./wasm.ts');
    errors.innerText = '';
    errors.style.display = 'none';
    const args = collectParams(id, params);
    const prog = compiler.compile(source, { args });
    const p2tr = prog.toJSON().p2tr;
    address.value = p2tr;
    preview();
    return await Promise.all([
      utxos.load(p2tr),
      getBalances(p2tr).then(value => balance.value = String(value)),
    ])
  })
} = {}) => init();

const SelectSender = ({
  chain    = null,
  balance  = null,
  onchange = () => {},
  users    = [],
  name     = 'Sender:',
  utxos    = UtxoList({ esplora: chain.esplora }),
  view     = Html(['div.col.select-sender', Label(name, ['select.pick-user']), balance]),
  input    = view.querySelector('input'),
  select   = Object.assign(view.querySelector('select'), { onchange: () => update() }),
  update   = () => {
    const pubkey = select.value;
    select.innerHTML = '';
    for (const option of usersToOptions(users)) select.appendChild(option);
    select.value = pubkey;
    const user = users.find(x=>x.pubkey === pubkey);
    if (user) {
      Promise.all([
        getBalances(user.p2wpkh.address).then(value=>input.value = value),
        utxos.load(user.p2wpkh.address),
        onchange(),
      ])
    }
    return { name, balance, view, input, select, utxos, update };
  },
} = {}) => update();

const ProgramField = ({ users, kind, id }) => ([name, type]) => {
  const label = `${kind}${name} (${type})`;
  console.log(label);
  if (type === 'u256') return SelectPubkeyX(`${id}:${name}`, { users, name: label }).view;
  if (type === 'u32')  return InputAmount(`${id}:${name}`, label);
  console.warn(label);
};

const ProgramForm = (id: string, ...rest: unknown[]) =>
  [`div.program-form.col.grow#${id}`, ...rest];

const InputAmount = (id: string, name = 'Amount:') =>
  ['label', ['strong', name], Input({ id })];

const SelectPubkey = (id: string, {
  users  = [],
  name   = 'Pubkey:' as string,
  view   = Html(['div.select-pubkey', Label(name, ['select.pick-user']), Input({ id, className: 'pubkey' })]),
  input  = view.querySelector('input'),
  select = Object.assign(view.querySelector('select'), { onchange: () => update() }),
  update = () => {
    const pubkey = select.value;
    select.innerHTML = '';
    for (const option of usersToOptions(users)) select.appendChild(option);
    select.value = pubkey;
    input.value = select.value;
    document.getElementById('compile')?.click();
    return { name, view, input, select, update };
  },
} = {}) => update();

const SelectPubkeyX = (id: string, {
  users  = [],
  name   = 'Pubkey:' as string,
  view   = Html(['div.select-pubkey', Label(name, ['select.pick-user']), ['input.pubkey', { id }]]),
  input  = view.querySelector('input'),
  select = Object.assign(view.querySelector('select'), { onchange: () => update() }),
  update = () => {
    const pubkey = select.value;
    select.innerHTML = '';
    for (const option of usersToOptions(users, user => user.pubkeyX)) select.appendChild(option);
    select.value = pubkey;
    input.value = select.value;
    document.getElementById('compile')?.click();
    return { name, view, input, select, update };
  },
} = {}) => update();


const InputBalance = ({
  address = undefined,
  value   = '',
  label   = ['strong', 'Balance:'],
  input   = [`input.balance[balance=${address}]`, { disabled: true, value }]
} = {}) => {
  return Html(['label.grow', label, input]).firstChild;
}

const collectParams = (id: string, params) => {
  const args = {}
  for (const [param, type] of Object.entries(params)) {
    let value = (Html.id(`${id}:${param}`) as HTMLInputElement)?.value;
    if (type == 'u256') value = '0x' + value; // FIXME
    args[param] = { type, value };
  };
  return args;
}

const UtxoList = ({
  esplora,
  address = null,
  utxos   = [],
  view    = Html(['ul.utxos']).firstChild as HTMLElement,
  state   = () => ({ address, utxos, load }),
  load    = (addr = address)=> {
    address = addr;
    if (!address) return view;
    console.debug('Loading UTXOs for', address);
    view.innerText = 'Loading UTXOs...';
    return Object.assign(ErrorBoundaryAsync(view, initUtxoList), state());
    async function initUtxoList () {
      const utxos = await esplora.getAddressUtxos(addr);
      console.debug('UTXOS for', address, ...utxos);
      if (utxos.length === 0) {
        view.innerText = 'No balance here. Send some funds!';
      } else {
        view.innerText = '';
        for (const utxo of utxos) {
          Html.append(view, Html(['li', ['strong', 'UTXO '], Amount(utxo), Txid(utxo)]));
        }
      }
      return view;
    }
  }
}) => Object.assign(view, state());

const examplePrograms = ({ users }) => ['div.files',
  ExamplePrograms.P2PK.view({ users }),
  ExamplePrograms.P2PKH.view({ users }),
  ExamplePrograms.HodlVault.view({ users })
];

const ExamplePrograms = {
  /** Empty program (always passes). */
  Nop:         await EditableProgram('Nop', `fn main () {}`),
  /** Asserts truth (always passes but has different address from [Nop]). */
  AssertTrue:  await EditableProgram('AssertTrue', `fn main () {
    assert!(true);
  }`),
  /** Asserts falsity (always fails). */
  AssertFalse: await EditableProgram('AssertFalse', `fn main () {
    assert!(false);
  }`),
  /** Pay to public key: minimal witness program. */
  P2PK:        await EditableProgram('P2PK', `fn main () {
    jet::bip_0340_verify((param::PUB, jet::sig_all_hash()), witness::SIG);
  }`),
  /** Pay to public key: minimal witness program. */
  P2PKH:       await EditableProgram('P2PKH', `fn main () {
    let pubkey: Pubkey = witness::PUB;
    let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, pubkey);
    let hash:   u256 = jet::sha_256_ctx_8_finalize(hasher);
    assert!(jet::eq_256(hash, param::PKH));
    jet::bip_0340_verify((pubkey, jet::sig_all_hash()), witness::SIG);
  }\n`),
  /** Hodl vault: prototype workhorse. */
  HodlVault:   await EditableProgram('HodlVault', `fn main () {
    let min_height: Height = param::MIN_HEIGHT;
    let target_price: u32 = param::TARGET_PRICE;
    let oracle_price: u32 = witness::ORACLE_PRICE;
    let oracle_height: Height = witness::ORACLE_HEIGHT;
    jet::check_lock_height(oracle_height);
    assert!(jet::le_32(min_height, oracle_height));
    assert!(jet::le_32(target_price, oracle_price));
    let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
    let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
    jet::bip_0340_verify((param::OWNER, jet::sig_all_hash()), witness::OWNER);
  }\n`),
};
function Section (...content: unknown[]): DocumentFragment {
  return Html(['section', ...content]) as DocumentFragment;
}
function Label (text: string, ...content: unknown[]): HTMLLabelElement {
  return Html(['label', ['strong', text], ...content]).firstChild as HTMLLabelElement
}
function Button (id: keyof typeof Button.Labels, onclick = () => {}): HTMLButtonElement {
  return Html(['button', Labels[id], { id, onclick }]).firstChild as HTMLButtonElement; // FIXME don't default to DocumentFragment
}
function Field (id: string, { open = false, header = [], content = [], sidebar = [] } = {}) {
  return {
    id,
    open:    bool => Field(id, { open: bool, header, content, sidebar }),
    header:  item => Field(id, { open, header: [...header, item], content, sidebar  }),
    content: item => Field(id, { open, header, content: [...content, item], sidebar }),
    sidebar: item => Field(id, { open, header, content, sidebar: [...sidebar, item] }),
    build:   () => Field.Wrapper(id, !open, Field.Handle(id, !open),
      ['div.field-body',
        Field.Header(id, ...header),
        ['div.field-content',
          ['div.field-editor', ...content],
          ['div.field-sidebar', ...sidebar]]]),
  }
}
namespace Field {
  export const Wrapper = (id: string, collapsed: boolean, ...rest: unknown[]) =>
    ([`div.field.file${collapsed?'.collapsed':''}#${id}[data-path=${id}]`, ...rest]);
  export const Handle = (id: string, collapsed: boolean) =>
    (['div.handle-v', Field.toggle(id), Field.Icon(collapsed), ['div.grow']]);
  export const Icon = (collapsed: boolean) =>
    (['svg.icon', [`use[href=${'icons.svg#'+(collapsed?'chevron-right':'chevron-down')}]`]]);
  export const Header = (id: string, ...header: unknown[]) =>
    (['div.flex.row.align-center',
      ['div.name', Field.toggle(id), id],
      ['div.handle-h', Field.toggle(id)],
      ...header]);
  export const Text = (id: string, ...content: string[]) =>
    Field(id).content(TextArea(id, ...content)).build();
  export const toggle = (id: string) => ({
    onclick: () => {
      const el = Html.id(id);
      console.log({id, el});
      const icon = el.querySelector('.icon') as SVGUseElement;
      el.classList.toggle('collapsed');
      if (el.classList.contains('collapsed')) {
        (icon.firstChild as SVGUseElement).href.baseVal = 'icons.svg#chevron-right';
      } else {
        (icon.firstChild as SVGUseElement).href.baseVal = 'icons.svg#chevron-down';
        const textarea = el.querySelector('textarea');
        if (textarea) {
          textarea.focus();
          Field.computeHeight(textarea);
        }
      }
    }
  });
  export const computeHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height ||= `${1.5*(1+Math.max(2, textarea.value.split('\n').length))}em`;
    return textarea;
  };
}
function TextArea (id: string, ...content: string[]) {
  return [`textarea.collapsible#text:${id}`,
    {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
    content.filter(x=>typeof x === 'string').join('\n')];
}
const Input = (...args: unknown[]): HTMLInputElement =>
  Html(['input', ...args]).firstChild as HTMLInputElement;
const InputTitle = () =>
  ['input.project-title[type=text]#title', { placeholder: 'name your project' }];
const InputSigHash = () =>
  ['label.gap', ['strong', 'Sign hash:'], ['input']]
function Select () { /* TODO */ }
function SelectChain () {
  return ['label.pick-chain', ['strong', 'Chain:'], ['select.pick-chain', ['option', 'liquidtestnet'], ['option', { disabled: true }, 'elementsregtest']]];
}
namespace Select {
  export function Recipient () {
    return ['label', ['strong', 'Recipient:'], ['select.pick-user']]
  }
  export function Program ({
    view = Html(['label', ['strong', 'Program:'], ['select.pick-program',
      ['option', 'Nop'], ['option', 'AssertTrue'], ['option', 'AssertFalse'],
      ['option', {'selected': true}, 'P2PK'], ['option', 'P2PKH'], ['option', 'HodlVault']]]).firstChild
  } = {}) {
    const select = view.querySelector('select');
    select.onchange = () => document.getElementById('compile')?.click();
    return view
  }
  export interface Update {
    update (_: Partial<this>): this
  }
  export interface WithInput extends Update {
    name:   string,
    view:   DocumentFragment,
    select: HTMLSelectElement,
    input:  HTMLInputElement,
  }
  export interface Sender extends Select.WithInput { balance: HTMLElement }
  export interface Pubkey extends Select.WithInput {}
  export interface Signer extends Select.WithInput {}
  export function Signer ({
    name   = null as string,
    update = (state: Select.Pubkey) => { console.error('Select.Signer: provide sighash first!'); return state },
    view   = Html(['label', ['em', name], ['div.col.gap', ['select.pick-user'], ['input.signed']]]),
    select = Object.assign(view.querySelector('select'), { onchange: update }),
    input  = view.querySelector('input')
  }: Partial<Select.Signer> = {}) {
    return update({ name, view, select, input, update });
  }
  export const License = () => [
    'select#licence', // Free software licensing helps the software stay free.
    ['option', 'AGPL 3.0 or later'],
    ['option', 'AGPL 3.0 only'],
    ['option', 'GPL 3.0 or later'],
    ['option', 'GPL 3.0 only'],
    ['option', 'Closed source (inquire)']];
}
async function getBalances (
  address: string,
  chain = Bitcoin.LiquidTestnet(),
  asset: string = "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5"
): Promise<bigint> {
  let balance = 0n;
  const utxos = await chain.esplora.getAddressUtxos(address);
  for (const utxo of utxos) if (utxo.asset === asset) balance += BigInt(utxo.value);
  return balance
}

/** An ECMAScript (JS/TS) module. */
function ES (id: string, ...content: string[]) {
  return Field(id).content(TextArea(id, ...content)).build()
}
namespace ES {
  export function Import (mod: string, ...items: (string|false|null)[]) {
    items = items.filter(x=>(typeof x === 'string'))
    if (items.length > 0) {
      return `import { ${items.join(', ')} } from "${mod}";`
    } else {
      return ''
    }
  }
  export const HashBang = ({ deno = false, node = false }) =>
    deno ? `#!/usr/bin/env -S deno run -I --coverage --allow-env --allow-run --allow-net` :
    node ? `#!/usr/bin/env -S npx tsx` :
    null;
  export const TestSuite = ({ deno = true, node = false, btc = true } = {}) => ES("test.ts",
      ES.HashBang({ deno, node }),
      ES.Import("@hackbg/fadroma", btc && 'Bitcoin', 'Test'),
      `import Program from './index.ts';`,
      `export default Test.suite(import.meta, Btc(`,
      `  Test.the("Build",    Program.build),`,
      `  Test.the("Deposit",  Program.deposit),`,
      `  Test.the("Withdraw", Program.withdraw)));`)
  export const DenoJson = ({
    deno = true
  } = {}) => deno && Field.Text('deno.json', '{',
  '  "permissions": {',
  '    "default": {',
  '      "run":   ["elementsd"],'   ,
  '      "write": ["/tmp/fadroma"],'   ,
  '      "env":   [',
  '        "FADROMA_SIMF_WASM", "FADROMA_SIMF_WRAP",',
  '        "TERM_PROGRAM", "COLUMNS", "NODE_V8_COVERAGE",',
  '        "TMPDIR", "TMP", "TEMP"',
  '      ],'   ,
  '    }',
  '  }',
  '}');
  export const PackageJson = ({ node, vite }) => Field.Text("package.json", `{`,
    `  "name":    "untitled",`,
    `  "type":    "module",`,
    `  "main":    "index.ts",`,
    `  "version": "0.1.0",`,
    `  "licence": "AGPL-3.0-or-later",`,
    `  "dependencies": {`,
    `    "@hackbg/fadroma": "https://github.com/hackbg/fadroma.git#v3-alpha"`,
    `  },`,
    `  "devDependencies": {`, [
      (node && `    "tsx":  "^4.20.6"`),
      (vite && `    "vite": "^7.2.2"`),
    ].filter(Boolean).join(',\n'),
    `  }`,
    `}`,
  );
  export const TsConfig = () => Field.Text("tsconfig.json", `{`,
    `  "compilerOptions": {`,
    `    "strict":                    false,`,
    `    "target":                    "esnext",`,
    `    "module":                    "esnext",`,
    `    "moduleResolution":          "bundler",`,
    `    "allowImportingTsExtensions": true,`,
    `    "noUnusedLocals":             false,`,
    `    "noUnusedParameters":         false,`,
    `    "isolatedModules":            false`,
    `  }`,
    `}`,
  );
}
function Nix ({ nix, elements }) {
  return nix && Field.Text("shell.nix",
    `#!/usr/bin/env nix-shell`,
    `{ pkgs ? import<nixpkgs> {} }: let`,
    `  gh = owner: repo: rev: sha256:`,
    `    pkgs.fetchFromGitHub { inherit owner repo rev sha256; };`,
    `  override = pkg: attrs:`,
    `    pkg.overrideAttrs (_: attrs);`,
    `in pkgs.mkShell { nativeBuildInputs = [`,
    `  just  # Shell command runner`,
    `  deno  # TypeScript runtime`,
    ...(elements
      ? [ ``
        , `  (override pkgs.elementsd {`
        , `    version = "liquid-testnet-2024-10-08";`
        , `    src = gh "ElementsProject" "elements"`
        , `      "f957d3cde17c85afb18c6747f9c0b4fcb599f19a"`
        , `      "sha256-XzdfbrQ7s4PfM5N00oP1jo5BNmD4WUMUe79QsTxsL4s=";`
        , `    withWallet = true;`
        , `    withGui = false;`
        , `    doCheck = false;`
        , `  })` ]
      : []),
    `\n]; }`);
}
function loadRepository ({
  view: _1 = null as DocumentFragment,
  url:  _2 = null as string|URL,
} = {}) {
  /* TODO */
}
function downloadProjectTemplate ({
  title   = textVal('title') || 'simplicityhl-starter-fadroma',
  license = textVal('license'),
  archive = {},
  initGit = true,
  initNix = true, // FIXME
}) {
  // Collect values of editors
  for (const el of Html.id("editors").querySelectorAll('[data-path]') as unknown as HTMLElement[]) {
    archive[el.dataset.path] = zipStr(el.querySelector('textarea')?.value);
  };
  // Set attributes of files
  const makeExecutable = (x: string) => {
    if (archive[x]) archive[x] = [archive[x], { os: 3, attrs: 0o755 << 16 }];
  };
  if (initGit) addGit(archive)
  if (initNix) makeExecutable('shell.nix');
  makeExecutable('index.ts');
  makeExecutable('test.ts');
  download(`${+new Date()}-${title}.zip`, 'application/zip', zipSync(archive))
}
function addGit (archive = {}) {
  // Add empty Git repo
  archive['.git/objects']     = { info:  {}, pack: {} };
  archive['.git/refs']        = { heads: {}, tags: {} };
  archive['.git/HEAD']        = zipStr('ref: refs/heads/main');
  archive['.git/description'] = zipStr('Created at https://fadroma.tech');
  archive['.gitignore']       = zipStr(joinLines('.direnv', 'coverage', 'node_modules', 'target'));
  archive['.git/config']      = zipStr(joinLines(
    '[core]',
    'repositoryformatversion = 0',
    'filemode                = true',
    'bare                    = false',
    'logallrefupdates        = true'));
  return archive
}

async function loadDocs (href: string) {
  const main = Html.id("main");
  const resp = await fetch(href);
  const html = await resp.text();
  const sect = new DocumentFragment();
  const docs = new DOMParser().parseFromString(html, 'text/html');
  docs.querySelectorAll(".namespaceSection").forEach(loadSection);
  main.innerHTML = '';
  main.appendChild(Html(['div.docs', sect]));
  function loadSection (section: HTMLElement) {
    section.querySelectorAll("span.italic").forEach(hideUndocumented);
    section.querySelectorAll(".docNodeKindIcon > div[title]").forEach(setKind);
    //const prepends = [];
    //section.querySelectorAll("[data-kind=Namespace]").forEach(el=>prepends.push(el));
    //section.querySelectorAll('[data-kind="FunctionType Alias"]').forEach(el=>prepends.push(el));
    //prepends.reverse().forEach(el=>section.prepend(el));
    sect.appendChild(section);
  }
  function hideUndocumented (span: HTMLElement) {
    if (span.innerText === "No documentation available") {
      span.innerHTML = '';
    }
  }
  function setKind (icon: HTMLDivElement) {
    const kind = icon.title;
    const item = icon.parentElement.parentElement;
    const link = item.querySelector('a');
    item.dataset.kind ??= "";
    item.dataset.kind += kind;
    if (kind === 'Namespace') {
      const checkbox = Object.assign(document.createElement('input'), {
        type: 'checkbox',
        id: `ns-${link.title}`
      });
      link.prepend(checkbox);
    }
    if (link.title.includes('.')) {
      const [ns, _] = link.title.split('.');
      item.dataset.ns = ns;
    }
  }
}

const checked = (id: string) => !!(Html.id(id) as HTMLInputElement)?.checked;

const textVal = (id: string) => (Html.id(id) as HTMLInputElement)?.value?.trim();

const byteVal = (id: string) => (Html.id(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME


function pinSize <T> (el: HTMLElement, cb: Fn<[number, number], T>) {
  const { offsetWidth: width, offsetHeight: height } = el;
  el.style.width  = String(width);
  el.style.height = String(height);
  let result: {ok:T}|{error:Error};
  try {
    result = { ok: cb(width, height) as T };
  } catch (e) {
    result = { error: e };
  }
  el.style = '';
  if ('ok' in result) return result.ok;
  throw result.error;
}

function download (name: string, type: string, ...parts: unknown[]) {
  const file = new File(parts as BlobPart[], name, { type });
  const url  = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function Nav () {
  Html.on(Html.id("navbar"), "click", navigate);
  Html.on(document.body, "click", ({ target }) => {
    while (target !== document.body) {
      //console.log(...target.classList)
      if (target.classList.contains('scroll-to')) {
        const y = target.offsetTop - 100;
        if (window.scrollY < y) scrollTo(Math.max(0, y));
        //console.log(target.offsetHeight, target.offsetTop, window.innerHeight, window.scrollY);
        break;
      }
      target = target.parentElement
    }
  })
}

async function navigate (e: Event) {
  let target = e.target as HTMLElement;
  do {
    if (target.dataset.action) switch (target.dataset.action) {
      case 'new':  e.preventDefault(); return Editor();
      case 'load': e.preventDefault(); return Editor.load();
      case 'save': e.preventDefault(); return Editor.save();
      case 'docs': e.preventDefault(); return loadDocs("/docs/deno/index.html");
      default: return;
    }
    target = target.parentElement;
  } while (target && target !== e.currentTarget);
}

async function P2P ({
  room      = 'fadroma',
  name      = 'unnamed',
  driver    = new P2P.NatsDriver(),
  receiver  = new Receiver({ driver }),
  sender    = new Sender({ driver }),
  root      = document.getElementById('identities'),
  onConnect = (e: unknown) => { console.debug('connect', e); root.innerText += JSON.stringify([e.name, e.detail]); },
  onDispose = (e: unknown) => { console.debug('dispose', e); root.innerText += JSON.stringify([e.name, e.detail]); },
  onMessage = (e: unknown) => { console.debug('message', e); root.innerText += JSON.stringify([e.name, e.detail]); },
  onStream  = (e: unknown) => { console.log('stream', e); },
} = {}): Promise<P2P> {
  await driver.open(room);
  receiver.start({ room });
  receiver.addEventListener('stream',  onStream);
  receiver.addEventListener('connect', onConnect);
  receiver.addEventListener('dispose', onDispose);
  receiver.addEventListener('channel:message', onMessage);
  sender.start({ room, channels: { chat: { ordered: true }, }, metadata: { pid: `${+ new Date()}`, nickname: name }, });
  const context = { room, driver, receiver, sender, send };
  return context;
  function send (message: unknown) {
    console.log('send', name, message, sender.connections);
    sender.connections.forEach((conn) => {
      console.log('send', name, message, conn);
      const channel = conn.channels.get('chat');
      if (channel && channel.readyState === 'open') {
        channel.send({ name, message });
      }
    });
  }
}

interface P2P {
  room:     string,
  driver:   P2P.NatsDriver,
  receiver: Receiver,
  sender:   Sender,
}

namespace P2P {
  // https://github.com/meefik/p2p/blob/59db42553fe46b24c07821ef8e4f184e4eb41427/LICENSE

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
