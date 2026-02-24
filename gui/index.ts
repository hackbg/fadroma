import { p2wpkh as P2WPKH } from 'npm:@scure/btc-signer';
import { pubECDSA } from 'npm:@scure/btc-signer/utils.js'; // not already in keypair?
import { Sender, Receiver } from 'npm:p2p';
import { connect, StringCodec } from 'npm:nats.ws';
import * as Monaco from 'npm:monaco-editor';
import { zipSync, strToU8 as zipStr } from 'npm:fflate';
import scrollTo from 'npm:animated-scroll-to';

import type { Bytes, Fn } from '../library/index.ts';
import Bitcoin from '../platform/Bitcoin/Bitcoin.ts';
import { Arg } from '../platform/SimplicityHL/SimplicityHL.ts';
import { Base16 } from '../library/Number.ts';
import Html from '../library/Html.ts';
import Wasm from './wasm.ts';

let chain = null; // Chain handle (initialized once)
let simf  = null; // WASM handle (initialized once)
const nonSecret = (n: number) => new Uint8Array(new Array(32).fill(n));
export const usersByName   = {};
export const usersByPubkey = {};

export default App;

/** Launch the editor and user views. */
function App ({
  /** Host element for developer view */
  editorView = elById("editors"), 
  /** Host element for user view */
  usersView  = elById("demousers"),
  /** Integrate with Bitcoin ecosystem */
  btc        = true,
  /** Provide Nix shell with project. */
  nix        = true,
  /** Auto-activate Nix shell. */
  direnv     = nix,
  /** Include Elements in Nix shell. */
  elements   = nix,
  /** Make the repo a Node.js package. */
  node       = false,
  /** Make the repo a Deno environment. */
  deno       = true,
  /** Configure the embedded SimplicityHL editor. */
  simf       = Simf({ nix, btc, elements, direnv, deno, node }),
} = {}) {
  editorView.innerHTML = '';
  Html.append(editorView, Html(['div.box.editors.col.grow.gap.justify-between', simf.view]));
  setTimeout(()=>initApp(editorView), 1);
  Program.Users({ view: usersView });
  return { editorView, usersView, simf };
}

function initApp (el: Element) {
  elById('title').focus();
  el.querySelectorAll('textarea').forEach((textarea: HTMLTextAreaElement & {
    monaco?: Monaco.editor.ITextModel
  })=>{
    Field.computeHeight(textarea);
    const content  = textarea.value;
    const language = textarea.dataset.language ??= 'nix';
    const uri      = textarea.dataset.uri ??= `fadroma://${+new Date()}`;
    const model    = Monaco.editor.createModel(content, language, Monaco.Uri.parse(uri));
    textarea.monaco = model;
    const wrapper  = Html.Div('.editor-wrapper');
    const editor   = Monaco.editor.create(wrapper, monacoOptions(language, model));
    let ignoreEvent = false;
    const updateHeight = () => {
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
    };
    editor.onDidContentSizeChange(updateHeight);
    updateHeight();
    textarea.parentElement.appendChild(wrapper);
    textarea.parentElement.removeChild(textarea);
  })
}

function monacoOptions (language, model) {
  return {
    language,
    model,
    scrollBeyondLastLine:                       false,
    wordWrap:                                   'on'       as const,
    wrappingStrategy:                           'advanced' as const,
    automaticLayout:                            true,
    minimap:                                    { enabled: false },
    overviewRulerLanes:                         0,
    scrollbar:                                  {
      alwaysConsumeMouseWheel:                  false,
      ignoreHorizontalScrollbarInContentHeight: true,
      horizontal:                               'hidden' as const,
      vertical:                                 'auto'   as const,
    },
  }
}

namespace App {

  export function update (e: InputEvent) {
    let target = e.target as HTMLElement;
    do {
      if (target?.id?.startsWith('enable:')) {
        console.log(target.id);
        return;
      }
      target = target.parentElement;
    } while (target && target !== e.currentTarget);
  };
}

export function loadRepository ({
  view: _1 = null as DocumentFragment,
  url:  _2 = null as string|URL,
} = {}) {
  /* TODO */
}

export function downloadProjectTemplate ({
  title   = textVal('title') || 'simplicityhl-starter-fadroma',
  license = textVal('license'),
  archive = {},
  initGit = true,
  initNix = true, // FIXME
}) {
  // Collect values of editors
  elById("editors").querySelectorAll('[data-path]').forEach((el: HTMLElement)=>{
    archive[el.dataset.path] = zipStr(el.querySelector('textarea')?.value);
  });
  // Set attributes of files
  const makeExecutable = (x: string) => {
    if (archive[x]) archive[x] = [archive[x], { os: 3, attrs: 0o755 << 16 }];
  };
  if (initGit) {
    // Add empty Git repo
    archive['.git/config'] = zipStr([
      '[core]',
      'repositoryformatversion = 0',
      'filemode                = true',
      'bare                    = false',
      'logallrefupdates        = true',
    ].filter(Boolean).join('\n')+'\n');
    archive['.git/description'] = zipStr('Created at https://fadroma.tech');
    archive['.git/HEAD']        = zipStr('ref: refs/heads/main');
    archive['.git/objects']     = { info: {}, pack: {} };
    archive['.git/refs']        = { heads: {}, tags: {} };
    archive['.gitignore']       = zipStr([
      '.direnv', 'coverage', 'node_modules', 'target'
    ].filter(Boolean).join('\n')+'\n');
  }
  makeExecutable('index.ts');
  makeExecutable('test.ts');
  if (initNix) {
    makeExecutable('shell.nix');
  }
  download(`${+new Date()}-${title}.zip`, 'application/zip', zipSync(archive))
}

export function Button () { /* TODO */ }

export namespace Button {

  export function Command (icon: string|null, ...content: unknown[]) {
    return [ 'div.command', icon && Icon(icon), ...content ]
  }

  export function Compile ({
    errors  = Html(['pre.compile-errors']).firstChild,
    label   = Html(['strong.grow', 'Program address:']),
    button  = Html(['button#compile', 'Compile', { style: 'padding:0 1rem; border: 1px solid #af48' }]),
    input   = Html(['input']),
    view    = Html(['label.col.gap.align-stretch', ['div.row.gap.justify-between', label, ['div.row.gap', button, input]], errors]).firstChild,
    chain   = Bitcoin.LiquidTestnet,
    genesis = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1',
  } = {}) {
    view.querySelector('button').onclick = compile;
    return { view, compile }
    async function compile () {
      //const { default: Wasm } = await import('./wasm.ts');
      errors.innerText = '';
      try {
        const compiler    = Wasm.compiler({ chain: chain.ID, genesis });
        const selected    = document.querySelector('.pick-program').value;
        const source      = Program[selected].source;
        const pubkeyValue = document.querySelector('#simf-compile .pubkey')?.value;
        const args        = { PUB: { type: 'Pubkey', value: `${pubkeyValue}` } };
        console.log({args});
        const program = compiler.compile(source, { args });
        const address = program.toJSON().p2tr;
        view.querySelector('input').value = address;
        const balance = await getBalances(address);
        console.debug('Balance of', address, 'is', balance);
        document.querySelector('#simf-witness .balance').value = String(balance)
      } catch (e) {
        errors.innerText = e.stack;
      }
    }
  }

  export function Commit ({
    view    = Html(['label', ['strong', 'Commit TX:'], ['button', 'Commit']]).firstChild,
    chain   = Bitcoin.LiquidTestnet,
    genesis = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1',
  } = {}) {
    view.querySelector('button').onclick = commit;
    return { view, commit }
    async function commit () {
      //const { default: Wasm } = await import('./wasm.ts');
      const compiler = Wasm.compiler({ chain: chain.ID, genesis });
      const program = compiler.compile(`fn main () {}`);
      const pubkey = document.getElementById('select-sender').value;
      const sender = usersByPubkey[pubkey];
      if (!sender) throw new Error(`not our pubkey: ${sender}`);
      const utxos = await chain().esplora.getAddressUtxos(sender.p2wpkh) as unknown[];
      if (utxos.length < 1) throw new Error(`fund the address first: ${sender.p2wpkh}`)
    }
  }

}

export function Field (id: string, { open = false, header = [], content = [] } = {}) {
  return {
    id,
    open:    bool => Field(id, { open: bool, header, content }),
    header:  item => Field(id, { open, header: [...header, item], content  }),
    content: item => Field(id, { open, header, content: [...content, item] }),
    build:   () => Field.Wrapper(id, !open, Field.Handle(id, !open),
      ['div.flex.col.grow', Field.Header(id, ...header), ...content]),
  }
}

export namespace Field {


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

  export const toggle = (id: string) => ({
    onclick: () => {
      const el = elById(id);
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
  };

  export function TextArea (id: string, ...content: string[]) {
    return [`textarea.collapsible#text:${id}`,
      {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
      content.filter(x=>typeof x === 'string').join('\n')];
  }

  export const Text = (id: string, ...content: string[]) =>
    Field(id).content(TextArea(id, ...content)).build();

  export const Hex = (id: string, ...content: unknown[]) =>
    Html([`div.field.file.hex#${id}`,
      ['div.handle-v', { onclick: Field.toggle(id) },
        ['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
        ['div.grow']],
      ['div.flex.col.grow',
        ['div.flex.row',
          ['div.name',     { onclick: Field.toggle(id) }, id],
          ['div.handle-h', { onclick: Field.toggle(id) }]],
        HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

  export const HexRow = (addr, bytes, chars) => ['div.row.hex-row', addr, bytes, chars];

}

export function Input () { /*TODO*/ }

export namespace Input {
  export const Title = () =>
    ['input#title[type=text][focused=focused]', { placeholder: 'name your project' }];
  export const Balance = () =>
    ['label.row.gap', ['strong.grow', 'Balance:'], ['input.balance', { disabled: true }]]
  export const SigHash = () =>
    ['label', ['strong', 'Sign hash:'], ['input']]
}

export function Select () { /* TODO */ }

export namespace Select {

  export const Chain     = () => ['label', ['strong', 'Chain:'],     ['select.pick-chain',   ['option', 'liquidtestnet']]];

  export const Recipient = () => ['label', ['strong', 'Recipient:'], ['select.pick-user']]

  export const Program   = ({
    view = Html(['label', ['strong', 'Program:'], ['select.pick-program',
      ['option', 'Nop'], ['option', 'AssertTrue'], ['option', 'AssertFalse'],
      ['option', {'selected': true}, 'P2PK'], ['option', 'P2PKH'], ['option', 'HodlVault']]]).firstChild
  } = {}) => {
    const select = view.querySelector('select');
    select.onchange = () => document.getElementById('compile').click();
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

  export interface Sender extends Select.WithInput {}
  export interface Pubkey extends Select.WithInput {}
  export interface Signer extends Select.WithInput {}

  export function Pubkey ({
    name = null as string,
    view = Html(['label.col.gap.select-pubkey', { style: 'align-items:stretch' }, ['div.row.gap', ['em.grow', name], ['select.pick-user']], ['input.pubkey']]),
    input = view.querySelector('input'),
    select = view.querySelector('select'),
    update = (state: Select.Pubkey) => { state.input.value = state.select.value; return state },
  }: Partial<Select.Pubkey> = {}): Select.Pubkey {
    const state = { name, view, select, input, update };
    select.onchange = () => { update(state); document.getElementById('compile').click() };
    return update(state);
  }

  export function Sender ({
    name = 'Sender:',
    view = Html(['label.col.gap', { style: 'align-items:stretch' },
      ['div.row.gap', ['string.grow', name], ['select.pick-user']],
      Input.Balance()
    ]).firstChild,
    input = view.querySelector('input'),
    select = view.querySelector('select'),
    update = (state: Select.Sender) => { setTimeout(()=>updateSenderBalance(state), 1); return state },
  }: Partial<Select.Sender> = {}): Select.Sender {
    const state = { name, view, select, input, update };
    select.onchange = () => update(state);
    return update(state);
  }

  async function updateSenderBalance ({ select, input }) {
    const pubkey = select.value;
    const sender = usersByPubkey[pubkey];
    input.value = String(await getBalances(sender.p2wpkh));
  }

  export function Signer ({
    name   = null as string,
    update = (state: Select.Pubkey) => { console.error('Select.Signer: provide sighash first!'); return state },
    view   = Html(['label', ['em', name], ['div.row.gap', ['select.pick-user'], ['input.signed']]]),
    select = Object.assign(view.querySelector('select'), { onchange: update }),
    input  = view.querySelector('input')
  }: Partial<Select.Signer> = {}) {
    return update({ name, view, select, input, update });
  }

  export function findUserPickers (): HTMLSelectElement[] {
    return document.querySelectorAll('select.pick-user') as unknown as HTMLSelectElement[]
  }

  export function initUserPicker (
    select: HTMLSelectElement, users: { name: string, p2wpkh: string, pubkey: string }[]
  ) {
    select.innerHTML = '';
    for (const user of users) {
      const label = `${user.name} (${user.p2wpkh.slice(0, 10)}...)`
      select.appendChild(Html(['option', { value: Base16.encode(user.pubkey) }, label]));
    }
    if (select.onchange) select.onchange(null);
  }

  export const License = () => [
    'select#licence', // Free software licensing helps the software stay free.
    ['option', 'AGPL 3.0 or later'],
    ['option', 'AGPL 3.0 only'],
    ['option', 'GPL 3.0 or later'],
    ['option', 'GPL 3.0 only'],
    ['option', 'Closed source (inquire)']];

}

export function Icon (name: string) {
  return ['svg.icon', [`use[href=icons.svg#${name}]`]]
}

export namespace Icon {
  // preset icons
}

async function getBalances (
  p2wpkh: string,
  chain = Bitcoin.LiquidTestnet(),
  asset: string = "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5"
): Promise<bigint> {
  let balance = 0n;
  const utxos  = await chain.esplora.getAddressUtxos(p2wpkh);
  for (const utxo of utxos) if (utxo.asset === asset) balance += BigInt(utxo.value);
  return balance
}

export function Simf ({
  nix       = true,
  btc       = true,
  simf      = true,
  elements  = true,
  direnv    = true,
  deno      = true,
  node      = false,
  view = Html(
    ['div.col.gap',
      ['section.layer', Texts[0]],
      ['section.layer.programs', Texts[1], ['div.col.grow.files.gap',
        Program.P2PK.wrapped(),
        Program.P2PKH.wrapped(),
        Program.HodlVault.wrapped()]],
      ['section.layer.actions',  Texts[2], ['div.col.grow.gap',
        ['section.phase', Texts[3], ['div.phase-form.row.grow',
          Program.Form('simf-compile', Program.CompileTitle, Select.Chain(),
            Select.Program(),
            Select.Pubkey({ name: 'param::PUB' }).view,
            Button.Compile().view),
          Program.Form('simf-commit', Program.FundTitle, Select.Sender().view,
            ['label.row.gap', ['strong.grow', 'Amount:'],
            ['input.balance[type="number"]', { value: '2345' }]],
            Button.Commit().view)]],
        ['section.phase', Texts[4], ['div.phase-form.row.grow',
          Program.Form('simf-witness', Program.WitnessTitle, Input.Balance(), Select.Recipient(),
            ['label', ['strong', 'Amount:'],   ['input[type="number"]', { value: '1234' }]],
            Input.SigHash()),
          Program.Form('simf-redeem', Program.RedeemTitle, Select.Signer({ name: 'witness::SIG' }).view,
            ['label', ['strong', 'TX bytes:'],        ['input']],
            ['label', ['strong', 'Redeem TX:'],       ['button', 'Redeem',]])]]]],
      ['section.layer.project',  Texts[5], ['div.col.grow.files.gap',
        Program.Metadata(),
        Program.Readme(),
        Field.Text("Justfile", "TODO"),
        ES.TestSuite({ deno, node, btc }),
        ES.DenoJson({ deno }),
        Nix({ nix, btc, simf, elements }),
        direnv && Field.Text(".envrc", "use nix")]]])
} = {}) {
  return { view }
}

const Texts = {

  0: ['p'
     , ['strong', 'Fadroma V3'], ' employs WebAssembly to instantly compile, evaluate, and deploy '
     , ['strong', 'SimplicityHL smart contracts'], ' from modern JavaScript-based environments: browsers, servers, and edge services.'],

  1: ['p.sidebox.flex.space-between'
     , ['div.grow', 'Try these ', ['strong', 'SimplicityHL programs'], ' on ', ['a', { href: 'https://blockstream.info/liquidtestnet/' }, 'Liquid Testnet:'], ' ']
     , Chain().view],

  2: ['p.sidebox', 'The ', ['strong', 'Simplicity transaction lifecycle'], ' happens in two phases:' ],

  3: ['p', ['span', ['strong', Dropcap('A. '), 'Commitment phase'], '. Compile program to P2TR address, and fund it on-chain:']],

  4: ['p', ['span', ['strong', Dropcap('B. '), 'Redemption phase'], '. Fulfill the program\'s conditions to redeem funds:']],

  5: ['p.sidebox', 'Here you can ', ['strong', 'download an example project'], ' containing the above programs.'],

  //['p.smol', ['strong', 'Local dev dependencies'], ' can be provided by Nix and Direnv (or bring your own Deno, Just and Elements.).'],
  //ES.DenoJsonField(deno),
  //PackageJsonField({ node, vite }),
  //TsConfigField(),
  //['p.smol', ['strong', 'Fast integration testing'], ' on ', ['code', 'elementsregtest'],
    //' and ', ['code', 'liquidtestnet'], ' out of the box:'],
};

export const Urls = {
  anchorCrate: "https://docs.rs/anchor-lang/latest/anchor_lang/",
  btcRpc:      "https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_calls_list",
  btcTest:     "https://developer.bitcoin.org/examples/testing.html",
  codama:      "#",
  denoApi:     "https://docs.deno.com/api/deno/",
  denoStd:     "https://docs.deno.com/runtime/reference/std/",
  direnvWiki:  "https://github.com/direnv/direnv/wiki",
  edConfSpec:  "https://spec.editorconfig.org/",
  eslintConf:  "https://eslint.org/docs/latest/use/configure/",
  idlGuide:    "https://solana.com/developers/guides/advanced/idls",
  namadaRepo:  "https://github.com/namada-net/namada",
  nixInstall:  "https://nixos.org/download/",
  nixPkgs:     "https://search.nixos.org/packages",
  nodeApi:     "https://nodejs.org/api/index.html",
  pnpmCompare: "https://pnpm.io/feature-comparison",
  scrtHome:    "https://scrt.network/",
  simfJets:    "https://docs.rs/simfony-as-rust/latest/simfony_as_rust/jet/index.html",
  simfRef:     "https://docs.simplicity-lang.org/simplicityhl-reference/",
  solanaCrate: "https://docs.rs/solana-program/latest/solana_program/",
  solanaKit:   "#",
  solanaWeb3:  "#",
  tsxNpm:      "https://www.npmjs.com/package/tsx",
};

export function Program (id: string, ...content: string[]) {
  return Field(id)
    .header(Button.Command('play', 'Compile', { onclick: simfCompile(id) }))
    .header(Button.Command('circle-with-plus', 'Define'))
    .content(Field.TextArea(id, ...content))
    .content([`div.row#result:${id}`, ['div.grow']])
    .content([`div.row.simf-result`, ['strong', `P2TR: `],
      [`div.grow#commit:${id}`, `(not compiled)`],
      ['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]])
    .content([`div.row.simf-result`, ['strong.w', `Sighash: `],
        [`div.grow#cmr:${id}`, `(not generated)`],
        ['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]])
    .build();
}

export namespace Program {

  export namespace Nop {
    export const source = `fn main () {}`
  }

  export namespace AssertTrue {
    export const source = `fn main () { assert!(true); }`
  }

  export namespace AssertFalse {
    export const source = `fn main () { assert!(false); }`
  }

  export namespace P2PK {
    export const wrapped = () => ES("src/P2PK.simf.ts", SimfTS(source,
      { PK: Arg("Pubkey") }, { "SIG": Arg("Signature") }));
    export const source = `fn main () {
  jet::bip_0340_verify((param::PUB, jet::sig_all_hash()), witness::SIG)
}`;
  }

  export namespace P2PKH {
    export const wrapped = () => ES("src/P2PKH.simf.ts", SimfTS(source,
      { "PKH": Arg("Pubkey") }, { "PUB": Arg("Pubkey"), "SIG": Arg("Signature") }));
    export const source = `fn main () {
  let pubkey: Pubkey = witness::PUB;
  let hasher: Ctx8 = jet::sha_256_ctx_8_init();
  let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, pubkey);
  let hash:   u256 = jet::sha_256_ctx_8_finalize(hasher);
  assert!(jet::eq_256(hash, param::PKH));
  jet::bip_0340_verify((pubkey, jet::sig_all_hash()), witness::SIG)
}`;
  }

  export namespace HodlVault {
    export const wrapped = () => Field("src/HodlVault.simf.ts")
      .open(true)
      .content(Field.TextArea("src/HodlVault.simf.ts", SimfTS(source,
        { "MIN_HEIGHT":   Arg("u32"), "TARGET_PRICE":  Arg("u32") },
        { "ORACLE_PRICE": Arg("u32"), "ORACLE_HEIGHT": Arg("u32") })))
      .build();
    export const source = `fn main () {
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
  jet::bip_0340_verify((param::OWNER, jet::sig_all_hash()), witness:OWNER);
}\``
  }

  const SimfTS = (source: string, param = {}, witness = {}) =>
    `#!/usr/bin/env -S deno run -P default\nimport { SimplicityHL } from 'fadroma';\n`      +
    `export default await SimplicityHL.Program('${source}', {\n`                                  +
    `  param:   ${JSON.stringify(param).split('\n').map(x=>'  '+x).join('\n').trim()},\n`   +
    `  witness: ${JSON.stringify(witness).split('\n').map(x=>'  '+x).join('\n').trim()},\n` +
    `  cli:     import.meta\n})`;

  export const Form = (id, name: string|unknown[], ...rest: unknown[]) =>
    [`div.program-form.col.grow#${id}`, ['div.title', name], ...rest];

  export const CompileTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'A1. '], 'Obtain P2TR'],
    ' by compiling the program:'];

  export const FundTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'A2. '], 'Send funds'],
    ' to the P2TR address:'];

  export const WitnessTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'B1. '], 'Specify transaction'],
    ' to obtain SIGHASH_ALL:'];

  export const RedeemTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'B2. '], 'Receive funds'],
    ' by sending valid signatures:'];

  export const OracleForm = () => Witness("oracle.wit", 
    WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
    WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
    WitnessRow('sig', 'ORACLE_SIG',    ''),
    WitnessRow('sig', 'OWNER_SIG',     ''));

  export const OracleTS = ({ deno, node }) => ES("oracle.ts",
    ES.HashBang({ deno, node }),
    ES.Import("@hackbg/fadroma", simf && 'Simf'),
    simf && `export default Simf(import.meta, "src/main.simf");`);

  export const Witness = (id: string, ...content: unknown[]) => Field(id).open(false)
    .header(['select', ['option', 'src/main.simf']])
    .header(Button.Command('play', 'Satisfy', { onclick: simfCompile(id) }))
    .content([['div.col.collapsible',
      WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      WitnessRow('sig', 'ORACLE_SIG',    ''),
      WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], Button.Command('circle-with-plus', 'Witness')]]])
    .build();

  export const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    ['div.witness',
      ['input[type=text].grow', { value: k, placeholder: 'name' }],
      ['label', ['select', ['option', { value: t }, t]]],
      ['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      Button.Command('circle-with-cross', 'Remove')];

  export const SimfFn = (name: string, ...content: unknown[]) =>
    ['div.col.fn',
      ['div.row.align-center',
        ['strong.keyword', 'fn '],
        [`input[type=text][size=${name.length-2}]`, { value: name }],
        '(', [`input[type=text][size=2]`], ')',
        ' { ',
        ['div.grow'],
        Button.Command('circle-with-cross', 'Remove')],
      ['textarea', content.join('\n')||' '], '}'];

  export const Readme = () =>
    ['div.col.gap', Field.Text("README",   "Created at https://fadroma.tech")];

  export const Metadata = () =>
    ['div.row.fields.gap',
      ['div.field.head.grow', ['div.name.title', 'Title'], Input.Title()],
      ['div.field.head',      ['div.name', 'Licence'],     Select.License()],
      ['div.row.fields',      ['div.field.head.grow', ['div.name', 'Download']]]];

  export function Users ({
    view = document.getElementById('demousers'),
    users = [
      addUser('Alice', { secret: nonSecret(1) }),
      addUser('Bob',   { secret: nonSecret(2) }),
      addUser('Carol', { secret: nonSecret(3) })
    ]
  }) {
    for (const user of users) Html.append(view, user.view());
    for (const select of Select.findUserPickers()) Select.initUserPicker(select, users);
  }

  export function addUser (name, options): User {
    if (usersByName[name]) throw new Error(`user already exists: ${name}`);
    const user = User(name, options)
    const pubkey = Base16.encode(user.pubkey)
    if (usersByPubkey[pubkey]) throw new Error(`pubkey already exists: ${name}: ${pubkey}`)
    usersByName[name] = user;
    usersByPubkey[pubkey] = user;
    return user;
  }

  export interface User {
    pubkey
    pubkeyX
    p2wpkh
    view
  }

  export function User (name: string, {
    secret   = new Uint8Array(Array(32).fill(1)),
    signer   = Wasm.keypair(secret),
    pubkey   = pubECDSA(secret),
    pubkeyX  = signer.xOnlyPublicKey(),
    //chain    = { bech32: 'ert', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, },
    chain    = { bech32: 'tex', blech32: 'tlq', pubKeyHash: 36, scriptHash: 19, wif: 0xef, },
    p2wpkh   = P2WPKH(pubkey, chain).address,
    output   = Html(['div.demolog', 'Enter Bob, Carol.']),
    //p2p      = P2P({ name, root: output }),
    balance  = Html(['span.balance', 'Loading balance...']).firstChild,
    toolbar  = Html(['section.demoprogs', ['button.pill', 'Send'], ['button.pill', 'P2PK'], ['button.pill', 'Vault'], ['button.pill', 'Escrow'], ['input.chat', { placeholder: 'chat' }], ['button.pill', 'Say']]),
    identity = Html(['section.demometa', ['div.col.gap', ['div.row.gap.align-center', ['strong.demoname', name], ['strong', balance]]]]),
  } = {}): User {
    Bitcoin.LiquidTestnet().esplora
    return {
      name,
      signer,
      pubkey,
      pubkeyX,
      p2wpkh,
      view: () => Html(['div.col.align-center',
        ['article.demouser', identity, output, toolbar],
        ['div.col.gap', ['div.col', ['strong', 'Address:'], ['div.address', p2wpkh]]]])
          //['div.col', ['strong', 'Pubkey:'],  ['div.address', Base16.encode(pubkey)]],
          //['div.col', ['strong', 'Tweaked:'], ['div.address', Base16.encode(pubkeyX)]],
    }
  }

}

function simfCompile (id) {
  return async e => {
    simf ??= await import('../platform/SimplicityHL/pkg/fadroma_simf.js')
    console.log(e.target)
    const resp = await fetch('/wasm/simf.wasm');
    const wasm = await resp.bytes();
    console.log({simf, resp, wasm});
    console.log(await simf.default(wasm));
    const result = simf.build('fn main () {}', {});
    console.log({result});
    document.getElementById(`result:${id}`).style.whiteSpace = 'pre';
    document.getElementById(`commit:${id}`).innerText = result.commit;
    document.getElementById(`cmr:${id}`).innerText = result.cmr;
    document.getElementById(`amr:${id}`).innerText = result.amr;
    document.getElementById(`ihr:${id}`).innerText = result.ihr;
  }
}

export function ES (id: string, ...content: string[]) {
  return Field(id).content(Field.TextArea(id, ...content)).build()
}

export namespace ES {

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

  export const TestSuite = ({ deno, node, btc } = {}) => ES("test.ts",
      ES.HashBang({ deno, node }),
      ES.Import("@hackbg/fadroma", btc && 'Btc', 'Test'),
      `import Program from './index.ts';`,
      `export default Test.suite(import.meta, Btc(`,
      `  Test.the("Build",    Program.build),`,
      `  Test.the("Deposit",  Program.deposit),`,
      `  Test.the("Withdraw", Program.withdraw)));`)

  export const DenoJson = ({ deno } = {}) => deno && Field.Text('deno.json', '{',
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

export function Nix ({ nix, btc, simf, elements }) {
  return nix && Field.Text("shell.nix",
    `#!/usr/bin/env nix-shell`,
    `{ pkgs ? import<nixpkgs> {} }: let`,
    //`  # Build Rust package.`,
    //`  rs = p: (pkgs.rustPlatform.buildRustPackage p);`,
    `  gh = owner: repo: rev: sha256: pkgs.fetchFromGitHub { inherit owner repo rev sha256; };`,
    //`  # Build Rust package from GitHub.`,
    //`  rs-gh = owner: pname: version: sha256: cargoHash: (rs rec {`,
    //`    inherit pname version cargoHash;`,
    //`    src = gh owner pname version sha256;`,
    //`    nativeBuildInputs = [pkgs.pkg-config];`,
    //`    PKG_CONFIG_PATH = "\${pkgs.openssl.dev}/lib/pkgconfig";`,
    //`  });`,
    `  override = pkg: attrs: pkg.overrideAttrs (_: attrs);`,
    `in pkgs.mkShell { nativeBuildInputs = [`,
    `  just  # Shell command runner`,
    `  deno  # TypeScript runtime`,

    //...(btc
      //? [ ``, `  pkgs.bitcoind` ]
      //: []),

    //...(simf
      //? [ ``
        //, `  pkgs.mcpp`
        //, ``
        //, `  (rs-gh "starkware-bitcoin" "simply" "3e1d0589"`
        //, `    "sha256-EKfeEsr/sG/SorT2GK/ovMvI2QaoTMZ1wehbCcSjEmQ="`
        //, `    "sha256-N2i5IJtKU1iPkpBaX90LgA7gw8B3n+K5hbByJOMRV3o=")`
        //]
      //: []),

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

/** Shout out. */
function Dropcap (...content) {
  return ['span', { style: 'float:left;font-size:2rem;padding-right:0.33rem' }, ...content]
}

/** Chain connection indicator button. */
function Chain ({ interval = 10000 } = {}) {
  const view = Html(['div.chain', ['strong.status', chain ? 'Connecting...' : 'Connected!'],
      ['div.row.gap', ['div', 'Height: '], ['strong.height']]]);
  const statusView = view.querySelector('.status') as HTMLDivElement;
  const heightView = view.querySelector('.height') as HTMLDivElement;
  const hashView   = view.querySelector('.hash')   as HTMLDivElement;
  chain ??= Bitcoin.LiquidTestnet();
  console.debug('Chain:', chain);
  statusView.innerText = 'Connected!';
  statusView.style.color = '#af8';
  const state = { view, nextUpdate: setTimeout(update, interval), interval };
  update()
  return state
  async function update () {
    await Promise.all([
      chain.esplora.getBlockTipHeight()
        .then(height => { heightView.innerText = height })
        .catch(e => {
          console.error(e)
          statusView.innerText = 'Error, retrying...';
          statusView.style.color = '#f84';
        }),
      //chain.esplora.getBlockTipHash().then(hash => { hashView.innerText = height })
        //.catch(console.error),
    ]);
    state.nextUpdate = setTimeout(update, state.interval)
  }
}

export function Platforms (
  sidebar  = elById("sidebar"),
  features = elById("features"),
) {
  on(features, "change", App.update);
  Html.append(features, Html(['p', 'Current and planned platform support:',]));
  Html.append(features, Html(['div.row.gap', ['ul.features',

    Platforms.Section({
      open: false,
      name: 'Bitcoin ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/240',
      features: [
        [true, 0, "enable:btc",      "Bitcoin",
          ["Develop and test with local bitcoind in ", Link(Urls.btcTest, "regtest"), " mode."],
          ["RPC", Urls.btcRpc]],
        [true, 0, "enable:elements", "Elements",
          ["Develop and test with local elementsd in ", Link(Urls.btcTest, "regtest"), " mode."],
          ["RPC", Urls.btcRpc]],
        [true, 0, "enable:simf",     "SimplicityHL",
          ["Compile and run ", Link(Urls.simfRef, "SimplicityHL"), " programs."],
          ["Language", Urls.simfRef],
          ["Jets", Urls.simfJets]]
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'Solana ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/237',
      features: [
        [false, 0, "enable:sol", "Solana", "Client for Solana.",
          ["Web3",   Urls.solanaWeb3],
          ["Kit",    Urls.solanaKit],
          ["Codama", Urls.codama]],
        [false, 1, "enable:sol-prog", "Solana Rust",
          "Write programs for Solana.",
          ["Core",   Urls.solanaCrate]],
        [false, 1, "enable:sol-prog", "Solana Anchor",
          "Framework for Solana programs.",
          ["IDL",    Urls.idlGuide],
          ["Anchor", Urls.anchorCrate]],
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'Cosmos ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/238',
      features: [
        [false, 0, "enable:tm", "Tendermint",
          "Client for Tendermint and compatibles."],
        [false, 1, "enable:namada", "Namada",
          ["Client and decoder for ", Link(Urls.namadaRepo, "Namada"), "."]],
        [false, 1, "enable:scrt", "Scrt",
          ["Client for ", Link(Urls.scrtHome, "Secret"), "."]],
        [false, 1, "enable:cw", "CosmWasm",
          "Write contracts for the Cosmos ecosystem."],
      ]
    }),

  ], ['ul.features', 

    Platforms.Section({
      open: false,
      name: 'JS / TS / ECMAScript ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/239',
      features: [
        [true, 0, "enable:deno", "Deno",
          "Run on next-gen TS/JS runtime by default.",
          ["@std", Urls.denoStd],
          ["API",  Urls.denoApi]],
        [true, 0, "enable:node", "Node.js",
          ["Will use ", Link(Urls.tsxNpm, "tsx"), " to run TypeScript."],
          ["API", Urls.nodeApi]],
        [true, 0, "enable:pnpm", "PNPM",
          ["Recommended package manager."], ["Compare", Urls.pnpmCompare]],
        [false, 0, "enable:eslint", "ESLint",
          "Static analyzer.", ["Platforms", Urls.eslintConf]],
        [false, 0, "enable:vite",
          "Vite", "Build your front-end in the same repo."]
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'Rust ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/236',
      features: [
        [false, 0, "enable:rust", "Rust",
          "Different targets may need different toolchains."],
        [false, 0, "enable:mold", "Mold",
          "Improves build times."],
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'DevOps / Unix ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
      features: [
        [true,  0, "enable:git",          "Git",
          "Automatically init Git repo in new project."],
        [true,  0, "enable:nix",          "Nix Shell",
          ["Obtain dependencies from ", Link(Urls.nixPkgs, "nixpkgs")],
          ["Install", Urls.nixInstall]],
        [true,  0, "enable:direnv",       "Direnv",
          ["Automatically load Nix shell when entering project directory."],
          ["Wiki", Urls.direnvWiki]],
        [false, 0, "enable:editorconfig", "EditorConfig",
          "IDE-agnostic settings.",
          ["Spec", Urls.edConfSpec]],
      ]
    }),

    Platforms.Section({
      open: false,
      name: 'CI / CD',
      help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
      features: [
        [false, 0, "enable:gha",          "GHA",
          "Platforms for GitHub Actions."],
        [false, 0, "enable:drone",        "Drone",
          "Platforms for Drone CI."],
        [false, 0, "enable:woodpecker",   "Woodpecker",
          "Platforms for Woodpecker CI."],
      ]
    }),

  ]]));
  return sidebar;
}

export namespace Platforms {

  export function Section ({
    open = false,
    name = '',
    help = null as string,
    features = [] as Array<[boolean, number, string, ...unknown[]]>
  }) {
    return ['details', { open },
      ['summary', name, (help ? ['a.help', { target: '_blank', href: help }, Icon('github')] : '')],
      ['ul.features', ...features.map(
        ([enabled, n, name, ...rest])=>(((!enabled) ? Feature.Disabled : Feature)(n, name, ...rest))
      )]
    ];
  }

}

export function Feature (
  depth: number,
  id: string,
  name = ``,
  description = `` as string|(unknown[]),
  ...links: [string, string?][]
) {
  return Html([`li.feature[data-depth=${depth}]`,
    ['div.row.between',
      [`label`, [`input[type=checkbox][checked=checked]`, { id }], name],
      Feature.Links(links)],
    ['p.grow', ...(typeof description === 'object')?description:[description]]
  ]);
}

export namespace Feature {
  export function Disabled (
    depth:       number,
    id:          string,
    name:        string = ``,
    description: string|(unknown[]) = ``,
    ...links:   [string, string?][]
  ) {
    return Html([`li.feature.disabled[data-depth=${depth}]`,
      ['div.row.between', [`label`, `⏳️  ${name}`], Feature.Links(links)],
      ['p.grow', ...(typeof description === 'object')?description:[description]]]);
  }
  export function Links (
    links: [string, string?][]
  ) {
    return ['div.row.links', ...links.map(([text, href = '#'])=>
      ['a.flex[target=_blank]', { href }, Icon("book"), text])]
  };
}

export async function loadDocs (href: string) {
  const main = elById("main");
  const resp = await fetch(href);
  const html = await resp.text();
  const sect = new DocumentFragment();
  const docs = new DOMParser().parseFromString(html, 'text/html');
  docs.querySelectorAll(".namespaceSection").forEach(loadSection);
  main.innerHTML = '';
  main.appendChild(Html(['div.docs', sect]));

  function loadSection (section: HTMLElement) {
    section.querySelectorAll("span.italic")
      .forEach(hideUndocumented);
    section.querySelectorAll(".docNodeKindIcon > div[title]")
      .forEach(setKind);
    //const prepends = [];
    //section.querySelectorAll("[data-kind=Namespace]")
      //.forEach(el=>prepends.push(el));
    //section.querySelectorAll('[data-kind="FunctionType Alias"]')
      //.forEach(el=>prepends.push(el));
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

export async function P2P ({
  room      = 'fadroma',
  name      = 'unnamed',
  driver    = new P2P.NatsDriver(),
  receiver  = new Receiver({ driver }),
  sender    = new Sender({ driver }),
  root      = document.getElementById('demo'),
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

export interface P2P {
  room:     string,
  driver:   P2P.NatsDriver,
  receiver: Receiver,
  sender:   Sender,
}

export namespace P2P {
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
export const elById  = (id: string) => document.getElementById(id);
export const checked = (id: string) => !!(elById(id) as HTMLInputElement)?.checked;
export const textVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim();
export const byteVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME
export const on = (x: EventTarget, ev: string, cb: Fn) => { x?.addEventListener(ev, cb); return cb; }
export const Link = (href: string, ...text: unknown[]) => ['a[target=_blank]', { href }, ...text];
export function pinSize <T> (el: HTMLElement, cb: Fn<[number, number], T>) {
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
export function download (name: string, type: string, ...parts: unknown[]) {
  const file = new File(parts as BlobPart[], name, { type });
  const url  = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function Nav () {
  on(elById("navbar"), "click", navigate);
  on(document.body, "click", ({ target }) => {
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

export async function navigate (e: Event) {
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
