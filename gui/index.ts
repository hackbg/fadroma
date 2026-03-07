import type { Bytes, Fn } from '../library/index.ts';
import type { ArgTypes } from '../platform/SimplicityHL/src/sdk.ts';
Error.stackTraceLimit = 100;
import Html, { Div, Input, Section, Option, Select } from '../library/Html.ts';
import { Button, Labeled, Texts, Icon }  from './cons.ts';
import { Err }                           from '../library/Err.ts';
import { Base16 }                        from '../library/Number.ts';
import { joinLines }                     from '../library/String.ts';
import { Transaction, p2wpkh as P2WPKH } from 'npm:@scure/btc-signer';
import * as Monaco                       from 'npm:monaco-editor';
import scrollTo                          from 'npm:animated-scroll-to';
import { pubECDSA }                      from 'npm:@scure/btc-signer/utils.js'; // not already in keypair?
import { zipSync, strToU8 as zipStr }    from 'npm:fflate';
import { Esplora, LiquidTestnet }        from '../platform/Bitcoin/index.ts';
import { Wasm }                          from '../platform/SimplicityHL/src/sdk.ts';
export const wasm = await Wasm({ wasm: new URL('/wasm/fadroma_simf_bg.wasm', location.href) });

/** Launch the Fadroma IDE in a set of HTML DOM root elements. */
export default ({
  /** Currently selected chain connector. */
  chain = Object.assign(LiquidTestnet(), { ID: 'liquidtestnet' /*FIXME*/ }),
  /** Host element for chains view. */
  chainsView = Html.id("chains"),
  /** Host element for developer view. */
  editorView = Html.id("editors"),
  /** Host element for user view. */
  usersView  = Html.id("users"),
  /** Encapsulated ephemeral identities. */
  users      = [ User('Alice', { secret: nonSecret(1) }),
                 User('Bob',   { secret: nonSecret(2) }),
                 User('Carol', { secret: nonSecret(3) }) ],
} = {}) => ({
  editorView: Editor(editorView, { chain, users }), // FIXME: must precede Users to populate pickers
  usersView:  Users(usersView, { users }),
  chainsView: Chains(Html.clear(chainsView), { chain }),
});

function Users (usersView: HTMLElement, { users }) {
  return Html.catcher(usersView, () => {
    Html.clear(usersView);
    for (const user of users) Html.append(usersView, user.view());
    // Retrieve all user selectors, to update them with the latest user list. */
    const selectors = document.querySelectorAll('select.pick-user');
    for (const select of selectors as unknown as HTMLSelectElement[]) {
      select.innerHTML = '';
      for (const user of usersToOptions(users)) select.appendChild(user);
      if (select.onchange) select.onchange(null);
    }
    return Object.assign(usersView, { users })
  })
}

/** User, as represented in the interface. */
export interface User {
  /** Human-friendly name. */
  name: string
  /** Main address of user. */
  p2wpkh: { address: string, script: Bytes }
  /** Public key of user. */
  pubkey: string
  /** X-Only (tweaked?) public key of user. */
  pubkeyX: string
  /** Can sign data with hidden secret key of user. */
  signer: ReturnType<typeof wasm.keypair>
  /** Render the user card. */
  view (): DocumentFragment
  /** Balance at init. */
  balance (): Promise<bigint>
  /** Sign a particular input of a transaction. */
  signTxIn: Fn
};

/** Create and dispay a user card. */
export function User (name: string, {
  secret   = null,
  signer   = wasm.keypair(secret),
  pubkey   = pubECDSA(secret),
  pubkeyX  = signer.xOnlyPublicKey(),
  signTxIn = (tx: Transaction, index: number) => tx.signIdx(secret, index),
  //chain    = { bech32: 'ert', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, },
  p2wpkh   = P2WPKH(pubkey, { bech32: 'tex', blech32: 'tlq', pubKeyHash: 36, scriptHash: 19, wif: 0xef }),
  output   = Html.el(['div.log', 'Enter Bob, Carol.']),
  //p2p      = P2P({ name, root: output }),
  toolbar  = Html.el(['section.progs', ['button.pill', 'Send'], ['button.pill', 'P2PK'], ['button.pill', 'Vault'], ['button.pill', 'Escrow'], ['input.chat', { placeholder: 'chat' }], ['button.pill', 'Say']]),
  identity = Html.el(['section.meta',  ['div.col.gap', ['div.row.gap.align-center', ['strong.name', name], ['div.col.gap', p2wpkh, ['strong', [`span.balance[balance=${p2wpkh.address}]`, 'Loading balance...']]]]]]),
  //identity = Html`(section.meta (.col.gap (.row.gap.align-center (strong.name ${name}) (.col.gap p2wpkh (strong ${balance})))))`,
  view     = () => Html.el(['div.col', ['article.user', identity, output, toolbar]]),
  balance  = () => getBalances(p2wpkh.address).then(value => {
    for (const element of document.querySelectorAll(`span[balance=${p2wpkh.address}]`) as unknown as HTMLElement[]) {
      element.innerText = `${value} sats`;
    }
    for (const element of document.querySelectorAll(`input[balance=${p2wpkh.address}]`) as unknown as HTMLInputElement[]) {
      element.value = String(value);
    }
    return value
  })
} = {}): User {
  const state = {
    name, signer, p2wpkh,
    view, balance, signTxIn,
    pubkey:  Base16.encode(pubkey),
    pubkeyX: Base16.encode(pubkeyX)
  };
  balance().then(value => console.debug(state, value));
  return state;
}

const usersToOptions = (users = [], value = (user: User) => user.pubkey) => users.map(user=>
  Option(value(user), ['strong', user.name], ` (${user.p2wpkh.address})`));

/** Chain connection indicator button. */
const Chains = (view = Html.id("chains"), {
  chain      = null,
  interval   = 10000,
  state      = { interval, nextUpdate: null, view, heightView: null, statusView: null, hashView: null },
  disabled   = (name: string) => ['div.chain.disabled.col.gap',
    ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to ', name],
      ['strong.status', 'SOON']]],
  disableder = (name: string) => ['div.chain.disableder.col.gap.grow',
    ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to ', name],
      ['strong.status', 'SOON']]],
  selected  = (name: string) => ['div.chain.active.col.gap',
    ['div.row.gap.align-center.justify-start',
      ['strong.status', chain ? Texts.CONNECTING : Texts.CONNECTED],
      ['h3.name', name], ['div.grow'], ['div.row.gap', ['div', 'Height: '], ['strong.height']]]],
  update = async (state: {
    view:       Node
    statusView: HTMLElement
    heightView: HTMLElement
    hashView:   HTMLElement
    interval:   number
    nextUpdate: ReturnType<typeof setTimeout>
  }) => {
    try {
      state.heightView.innerText = String(await chain.esplora.getBlockTipHeight());
    } catch (e) {
      console.error(e);
      state.statusView.innerText = Texts.CONNECT_ERROR;
      state.statusView.style.color = '#f84';
    } finally {
      state.nextUpdate = setTimeout(()=>update(state), state.interval);
    }
    return state
  }
} = {}) => Html.catcher(view, ()=>{
  Html.replace(view, state.view = Html.el(['div.col.gap',
    disabled('Liquid Mainnet'),
    selected('Liquid Testnet'),
    disabled('Liquid elementsregtest...'),
    disabled('Bitcoin Mainnet'),
    disabled('Bitcoin Testnet'),
    disabled('Bitcoin regtest...'),
    ['div.row.gap', disableder('Solana RPC...'), disableder('Tendermint RPC...')]
  ]));
  state.hashView = state.view.querySelector('.chain.active .hash') as HTMLDivElement;
  state.heightView = state.view.querySelector('.chain.active .height') as HTMLDivElement;
  state.statusView = state.view.querySelector('.chain.active .status') as HTMLDivElement;
  state.statusView.style.color = '#af8';
  state.statusView.innerText = Texts.CONNECTED;
  return update(state)
});

const Editor = (host: HTMLElement, {
  chain    = null,
  users    = [],
  header   = Section({ className: 'layer row', }, ['div.textbox', Texts.SIMPLICITYHL]),
  programs = Section({ className: 'layer programs col' }, ExamplePrograms({ chain, users })),

  // REFAC: wrap these as ProjectOptions or such
  btc      = true,
  nix      = true,
  direnv   = nix,
  elements = nix,
  node     = false,
  deno     = true,
} = {}) => Html.catcher(host, () => {
  host.innerText = '';
  const textareas = programs.querySelectorAll('#editor textarea');
  for (const textarea of textareas as unknown as HTMLTextAreaElement[]) {
    initEditor({ textarea: Field.computeHeight(textarea) });
  }
  Html.append(host, Html.el(['div.editors', header, programs]));
  Html.append(host, Section({ className: 'layer project' },
    ['div.col.grow.files.gap',
      ['div', ['h2', 'Project template:'], Texts.DownloadProject],
      ['div.row.fields',
        ['div.field.head.grow', ['div.name.title', 'Title'], InputTitle()],
        ['div.field.head', ['div.name', 'Licence'], SelectLicense()],
        ['div.row.fields', ['div.field.head.grow', ['div.name', 'Download']]]],
      ['div.col.gap', Field.Text("README", Texts.README)],
      Field.Text("Justfile", "TODO"),
        ES.TestSuite({ deno, node, btc }),
        ES.DenoJson({ deno }),
        nix && Nix({ elements }),
        direnv && Field.Text(".envrc", "use nix")]));
  return host;
});

const initEditor = ({
  textarea = null as  HTMLTextAreaElement & { monaco?: Monaco.editor.ITextModel },
  content  = textarea.value,
  language = textarea.dataset.language ??= 'nix',
  uri      = textarea.dataset.uri ??= `fadroma://${+new Date()}`,
  model    = textarea.monaco = Monaco.editor.createModel(content, language, Monaco.Uri.parse(uri)),
  wrapper  = Div('.editor-wrapper'),
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

async function EditableProgram (name: string, source: string, {
  view = ({
    chain  = null,
    host   = document.createElement('div') as HTMLElement, open = true, users = [],
    editor = ProgramEditor(`src/${name}.simf`, source, { chain, users, open })
  } = {}) => {
    return Html.replace(host, Html(editor));
  }
} = {}) {
  source = source.split('\n').map((line, index)=>(index > 0)?line.slice(2):line).join('\n');
  return { name, source, view }
}

function ProgramEditor (id: string, source: string, {
  users     = null,
  chain     = null,
  genesis   = chain?.GENESIS || 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1', // TODO autofetch from block 0
  compiler  = wasm.compiler({ chain: 'liquidtestnet' /*FIXME*/, genesis }),
  /** Testnet RPC proxy. */
  esplora   = chain.esplora,
  /** Whether the code editor starts out expanded. */
  open      = false,
  /** Error messages are displayed here. */
  errors    = Html.el(['pre.compile-errors.collapsible']) as HTMLElement,
  /** Commit amount: up to balance of selected sender. */
  amount    = InputAmount(() => preview(), 5000),
  /** Commit amount: up to balance of selected sender. */
  fee       = InputAmount(() => preview(), 10000),
  /** Commit transaction target: program's P2TR address. */
  address   = InputP2TR(() => preview()),
  /** Commit transaction funder: user-selectable. */
  sender    = SelectUserWithBalance(() => preview(), { chain, users }),
  /** Commit transaction preview. */
  preview   = TxPreview({ users, amount, fee, address, sender }),
  /** Compile form. */
  stage1    = CompileForm(id, source, { esplora, address, errors, compiler, users, preview }),
  /** Commit form. */
  stage2    = CommitForm(id, source, { esplora, users, compiler, errors, sender, amount, fee, preview }),
  /** Stage 3. Populate witnesses. */
  stage3    = RedeemForm(id, source, { chain, users, amount, address, sender }),
} = {}) {
  return Field(id).open(open).content(TextArea(id, source)).content(errors)
    .sidebar(stage1).sidebar(stage2).sidebar(stage3).build();
}

function CompileForm (id: string, source: string, {
  esplora, users, compiler, errors, address, preview,
  /** Commitment phase (compile-time) parameters. */
  params    = wasm.paramTypes(source),
  /** Commitment phase (compile-time) parameters rendered to form fields. */
  fields    = Object.entries(params).map(ArgField({ id, users, kind: 'Parameter: ' })),
  /** Try to compile the program, displaying any errors to the user. */
  compile   = () => compileProgram(id, source, { compiler, errors, address, instances, params, preview }),
  /** UTXOs of currently compiled P2TR. */
  instances = UtxoList(() => preview(), {
    esplora,
    notLoaded: 'Program commitment instances will appear here in the form of the P2TR\'s UTXOs.',
    noResults: 'The program\'s address contains no funds. You can send it some below.',
  }),
}) {
  return ProgramForm('simplicityhl-compile',
    ['h3', ['strong', 'Step 1.'], ' Compile the source for the selected chain with your chosen parameters.'],
    ['label.row',
      ['label.pick-chain', ['strong', 'Chain:'], ['select.pick-chain',
        ['option', { disabled: true }, 'liquid1'],
        ['option', { selected: true }, 'liquidtestnet'],
        ['option', { disabled: true }, 'elementsregtest']]],
      ['label.grow', ['div.row.align-stretch.justify-between',
        ['label.col.grow', ['strong', 'Compiled P2TR address of program:'], address],
        Button('compile', () => compile())]]],
    ['label', ...fields],
    ['label.col.align-stretch.noborder', instances, errors])
}

function CommitForm (id: string, source: string, {
  esplora, users, compiler, errors, sender, amount, fee, preview,
  /** Commitment phase (compile-time) parameters. */
  params = wasm.paramTypes(source),
  /** Sign and broadcast commit transaction from form values. */
  commit = () => commitProgram(id, source, { errors, params, compiler, users, sender, esplora, preview }),
}) {
  return ProgramForm('simplicityhl-commit',
    ['h3', ['strong', 'Step 2.'], ' Commit funds to the program\'s address.'],
    ['label.row',
      Labeled('Sender:', sender.select), sender.balance,
      Labeled('Amount:', amount), Labeled('Fee:', fee),
      Button('commit', () => commit())],
    ['label.tx-preview',
      sender.utxos,
      preview.inputs,
      preview.outputs])
}

function RedeemForm (id: string, source: string, {
  chain, users, address, sender,
  /** Redemption phase (evaluation-time) arguments. */
  witTypes = wasm.witnessTypes(source),
  /** Will receive funds from program. Needs to be specified to obtain sighash. */
  receiver = SelectUserWithBalance(() => preview(), { chain, users }),
  /** Redeem amount: up to balance of selected program. */
  amount   = InputAmount(() => preview(), 5000),
  /** Redeem amount: up to balance of selected program. */
  fee      = InputAmount(() => preview(), 10000),
  /** Redemption phase (evaluation-time) arguments rendered to form fields. */
  witness  = Object.entries(witTypes).map(ArgField({ id, users, kind: 'Witness: ' })),
  /** Derived from PSET a.k.a. PSBT a.k.a. PartiallySignedTransaction */
  sighash  = ['input', { placeholder: 'specify transaction to get its SIGHASH_ALL' }],
  /** Redeem transaction is built here. */
  preview  = TxPreview({ users, amount, fee, address, sender }),
}) {
  return ProgramForm('simplicityhl-redeem',
    ['h3', ['strong', 'Step 3.'], ' Specify redeem transaction and sign witness data to transfer funds out of the program.'],
    ['label.row',
      Labeled('Receiver:', receiver.select),
      receiver.balance,
      Labeled('Amount:', amount),
      Labeled('Fee:', fee),
      Button('redeem', () => {})],
    Labeled('Sighash', sighash), ['label.gap', ...witness])
}

function ProgramForm (id: string, ...rest: unknown[]) {
  return [`div.program-form.col.grow#${id}`, ...rest]
}

function SelectUserWithBalance (onchange = () => {}, {
  chain   = null,
  esplora = chain?.esplora,
  users   = [],
  balance = InputBalance({ label: ['strong', 'Balance:'], address: users[0]?.p2wpkh.address }),
  name    = 'Sender:',
  utxos   = UtxoList(onchange, { esplora }),
  select  = SelectUser(() => update()),
  view    = Html.el(['div.col.select-sender', Labeled(name, select), balance]),
  input   = view.querySelector('input'),
  state   = () => ({ name, balance, view, input, select, utxos, update }),
  update  = () => {
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
      ]).catch(console.error);
    }
    return state();
  },
} = {}) {
  return update();
}

function SelectUser (onchange?: Fn) {
  return Object.assign(Html.el(['select.pick-user']) as HTMLSelectElement, {
    onchange
  });
}

function compileProgram (id: string, source: string, {
  compiler, errors, address, instances, preview, params
}) {
  return Html.catcherAsync(errors, async () => {
    //const { default: wasm } = await import('./wasm.ts');
    errors.innerText = '';
    errors.style.display = 'none';
    const args = collectParams(id, params);
    const prog = compiler.compile(source, { args });
    const p2tr = prog.toJSON().p2tr;
    address.value = p2tr;
    preview();
    return await Promise.all([
      instances.load(p2tr),
      //getBalances(p2tr).then(value => balance.value = String(value)),
    ])
  })
}

function commitProgram (id: string, source: string, {
  errors, params, compiler, users, sender, preview, esplora
}) {
  return Html.catcherAsync(errors, async () => {
    const args = collectParams(id, params);
    const prog = compiler.compile(source, { args });
    const p2tr = prog.toJSON().p2tr;
    const user = users.find((x: User)=>x.pubkey === sender.select.value);
    if (!user) throw Err(`not our pubkey: ${user}`);
    const tx = await preview({ p2tr });
    const result = await esplora.postTx(tx);
    return result;
  })
}

const selectedUtxos = (view: HTMLElement) =>
  (Array.from(view.querySelectorAll('input[type=checkbox]')) as HTMLInputElement[])
    .filter(x=>x.checked).map(x=>((x as unknown as { utxo: Esplora.Utxo }).utxo));

function UtxoList (onchange = () => {}, {
  esplora    = null,
  address    = null,
  utxos      = [],
  notLoaded  = '',
  noResults  = 'No balance here yet. Send some funds!',
  view       = Html.el(['ul.utxos', notLoaded]) as HTMLElement,
  selected   = () => JSON.parse(JSON.stringify(selectedUtxos(view))),
  state      = () => ({ address, utxos, load, selected }),
  load       = (addr = address)=> {
    address = addr;
    if (!address) return view;
    view.innerText = 'Loading UTXOs...';
    return Object.assign(Html.catcherAsync(view, initUtxoList), state());
    async function initUtxoList () {
      const utxos = await esplora.getAddressUtxos(addr);
      if (utxos.length === 0) {
        view.innerText = noResults;
      } else {
        view.innerText = '';
        for (const utxo of utxos) Html.append(view, UtxoListItem(onchange, utxo));
      }
      return view;
    }
  }
} = {}) {
  console.log({view});
  return Object.assign(view, state());
}

const UtxoListItem = (onchange: Fn, utxo: Esplora.Utxo, {
  enable = Checkbox(onchange, { id: `${utxo.txid}-${utxo.vout}`, utxo }),
  amount = Amount(utxo),
  txid   = Txid(utxo),
  vout   = ['span.vout', '#', String(utxo.vout)],
  label  = ['label.row', { style: 'flex-grow: 0; align-items: center' }, enable, ['strong', 'UTXO ']],
  view   = ['li', label, amount, txid, vout],
} = {}) => {
  const el = Html.el(view) as HTMLElement;
  return el;
}

const TxPreview = ({
  users   = [],
  amount  = null,
  address = null,
  fee     = null,
  sender  = { select: { value: null }, utxos: { selected: () => [] } },
  inputs  = Html.el(['ul.inputs']),
  outputs = Html.el(['ul.outputs']),
  hexedit = Html.el(['div.hex']), // TODO
  /** Show the transaction's inputs and outputs. */
  display = (signed: {
    hex:     string,
    inputs:  { value }[],
    outputs: { script_pubkey, amount }[],
  }) => { 
    hexedit.innerText = signed.hex;
    Html.append(Html.clear(inputs), ...signed.inputs.map((input, index)=>{
      const title = ['strong', `TX Input ${index}:`];
      const value = Amount({ value: input.value });
      const from = Address({ address: address.value });
      return Html.el(['li', title, value, ['span', ' from '], from]);
    }));
    Html.append(Html.clear(outputs), ...signed.outputs.map(({ script_pubkey, amount: value })=>{
      const isFee = (script_pubkey === "");
      const target = isFee ? [] : ['to', Address({ address: script_pubkey })];
      const name = ['strong', isFee ? 'Fee: ' : 'Output: '];
      return Html.el(['li', name, Amount({ value }), ...target]).firstChild;
    }));
    return signed;
  },
  update  = async function updateTxPreview ({
    user  = sender?.select?.value,
    p2tr  = address?.value,
    value = amount?.value,
    cost  = fee?.value,
  } = {}) {
    const { signer, p2wpkh: { address } } = users.find(x=>x.pubkey === user) || { p2wpkh: {} };
    if (!signer) return console.warn('Select signer to preview transaction')
    const utxos = sender.utxos.selected();
    if (utxos.length < 1) throw Err(`No UTXOs selected.`);
    const balance = sumUtxos(utxos);
    if (balance < amount + cost) throw Err(`Insufficient balance.`);
    if (!p2tr) return console.warn('P2TR not selected. Compile the program')
    return display(wasm.sendSigned(signer, {
      asset:     utxos[0].asset,
      utxos:     utxos.map(utxo => ({ ...utxo, recipient: address, value: BigInt(utxo.value) })),
      sender:    address,
      recipient: p2tr,
      amount:    BigInt(value),
      fee:       BigInt(cost),
    }));
  }
}) => {
  update();
  return Object.assign(update, { inputs, outputs, hexedit });
}

const ArgField = ({ users, kind, id }) => ([name, type]) => {
  const label = `${kind}${name} (${type})`;
  console.log(label);
  if (type === 'u256') return SelectPubkeyX(`${id}:${name}`, { users, name: label }).view;
  if (type === 'u32') return InputU32(`${id}:${name}`, label);
  if (type === '[u8; 64]')  return InputU32(`${id}:${name}`, label); // FIXME signature
  console.warn(label);
};

const InputU32 = (id: string, name = 'Amount:') =>
  ['label', ['strong', name], Input({ id })];

const SelectPubkey = (id: string, {
  users  = [],
  name   = 'Pubkey:' as string,
  view   = Html.el(['div.select-pubkey', Labeled(name, ['select.pick-user']), Input({ id, className: 'pubkey' })]),
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
  view   = Html.el(['div.select-pubkey', Labeled(name, ['select.pick-user']), ['input.pubkey', { id }]]),
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
  return Html.el(['label.grow', label, input]);
}

const collectParams = (id: string, params: ArgTypes) => {
  const args = {}
  for (const [param, type] of Object.entries(params)) {
    let value = (Html.id(`${id}:${param}`) as HTMLInputElement)?.value;
    if (type as string === 'u256') value = '0x' + value; // FIXME
    args[param] = { type, value };
  };
  return args;
}

const Address     = ({ address }) => Input({ disabled: true, value: address });
const Txid        = ({ txid })    => Input({ disabled: true, value: txid });
const Amount      = ({ value })   => Input({ disabled: true, value: String(value), style: 'width:12ch; flex-grow: 0', });
const Checkbox    = (onchange = () => {}, ...args: unknown[]) => Input.Check({ onchange }, ...args);
const InputP2TR   = (onchange?: Fn) => Input({ onchange, placeholder: 'provide parameters and compile to get P2TR' });
const InputAmount = (onchange?: Fn, value?: number) => Input({ className: 'balance', type: 'number', value, onchange });

const ExamplePrograms = Object.assign(({ chain, users }) => ['div.files',
  ExamplePrograms.P2PK.view({ chain, users }),
  ExamplePrograms.P2PKH.view({ chain, users }),
  ExamplePrograms.HodlVault.view({ chain, users })
], {
  /** Empty program (always passes). */
  Nop:         await EditableProgram('Nop',         `fn main () {}`),
  /** Asserts truth (always passes but has different address from [Nop]). */
  AssertTrue:  await EditableProgram('AssertTrue',  `fn main () { assert!(true); }`),
  /** Asserts falsity (always fails). */
  AssertFalse: await EditableProgram('AssertFalse', `fn main () { assert!(false); }`),
  /** Pay to public key: minimal witness program. */
  P2PK:        await EditableProgram('P2PK', `fn main () {
    jet::bip_0340_verify((param::AUTHORITY, jet::sig_all_hash()), witness::SIGNATURE);
  }`),
  /** Pay to public key: minimal witness program. */
  P2PKH:       await EditableProgram('P2PKH', `fn main () {
    let pubkey: Pubkey = witness::AUTHORITY;
    let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, pubkey);
    let hash:   u256 = jet::sha_256_ctx_8_finalize(hasher);
    assert!(jet::eq_256(hash, param::HASH));
    jet::bip_0340_verify((pubkey, jet::sig_all_hash()), witness::SIGNATURE);
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
});

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
    (['button.handle-v', Field.toggle(id), Field.Icon(collapsed), ['div.grow']]);
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
function InputTitle () {
  return Input.Text({ className: 'project-title', id: 'title', placeholder: 'name your project' });
}
function SelectLicense () {
  // Free software licensing: it helps the software stay free.
  return Select({ className: 'pick-license', id: 'license' },
    ['option', 'AGPL 3.0 or later'], ['option', 'AGPL 3.0 only'],
    ['option', 'GPL 3.0 or later'], ['option', 'GPL 3.0 only'],
    ['option', 'Closed source (inquire)']);
}
async function getBalances (
  address: string,
  chain = LiquidTestnet(),
  asset: string = "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5"
): Promise<bigint> {
  return sumUtxos(await chain.esplora.getAddressUtxos(address), asset);
}
function sumUtxos (
  utxos: { asset: string, value: number }[],
  asset: string = "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5"
) {
  let balance = 0n;
  for (const utxo of utxos) {
    if (utxo.asset === asset) {
      balance += BigInt(utxo.value);
    } else {
      console.warn('skipping', utxo);
    }
  }
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
function Nix ({ elements }) {
  return Field.Text("shell.nix",
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
/** Add Git repo to project files. */
function addGit (archive = {}) {
  return Object.assign(archive, {
    '.git/objects':     { info:  {}, pack: {} },
    '.git/refs':        { heads: {}, tags: {} },
    '.git/HEAD':        zipStr('ref: refs/heads/main'),
    '.git/description': zipStr('Created at https://fadroma.tech'),
    '.gitignore':       zipStr(joinLines('.direnv', 'coverage', 'node_modules', 'target')),
    '.git/config':      zipStr(joinLines('[core]',
      'repositoryformatversion = 0',
      'filemode                = true',
      'bare                    = false',
      'logallrefupdates        = true')),
  })
}
/** INSECURE, TESTING/EXAMPLE USE ONLY: Generate private keys that are all 1s, all 2s... */
function nonSecret (n: number) {
  console.warn(`INSECURE, TESTING/EXAMPLE ONLY: Using non-private key №${n}`)
  return new Uint8Array(new Array(32).fill(n));
}
