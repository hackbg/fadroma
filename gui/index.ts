import * as Monaco                    from 'npm:monaco-editor';
import Bitcoin                        from '../platform/Bitcoin/Bitcoin.ts';
import Html                           from '../library/Html.ts';
import Wasm                           from './wasm.ts';
import scrollTo                       from 'npm:animated-scroll-to';
import type { Bytes, Fn }             from '../library/index.ts';
import { Base16 }                     from '../library/Number.ts';
import { Labels, Texts, Icon }        from './cons.ts';
import { Sender, Receiver }           from 'npm:p2p';
import { connect, StringCodec }       from 'npm:nats.ws';
import { p2wpkh as P2WPKH }           from 'npm:@scure/btc-signer';
import { pubECDSA }                   from 'npm:@scure/btc-signer/utils.js'; // not already in keypair?
import { joinLines }                  from '../library/String.ts';
import { zipSync, strToU8 as zipStr } from 'npm:fflate';
const chain = Bitcoin.LiquidTestnet(); // Chain handle (initialized once)
const nonSecret = (n: number) => new Uint8Array(new Array(32).fill(n));
export const usersByName   = {};
export const usersByPubkey = {};
/** Launch the editor and user views. */
export default function App ({
  /** Host element for chains view */
  chainsView = Html.id("chains"),
  /** Host element for developer view */
  editorView = Html.id("editors"),
  /** Host element for user view */
  usersView  = Html.id("users"),
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
} = {}) {
  chainsView.innerHTML = '';
  usersView.innerHTML = '';
  const state = {
    chainsView: ChainList(chainsView),
    editorView: SimfDemo(editorView, { nix, btc, elements, direnv, deno, node }),
    users:      UserList(usersView),
  };
  Html.id('identities').appendChild(Project(
    ES.TestSuite({ deno, node, btc }),
    ES.DenoJson({ deno }),
    Nix({ nix, elements }),
    direnv && Field.Text(".envrc", "use nix")));
  setTimeout(()=>SimfDemo.init(editorView), 1);
  return state;
}
/** Chain connection indicator button. */
export function ChainList (view = Html.id("chains"), {
  interval   = 10000,
} = {}) {
  const state = { interval, nextUpdate: null, view, heightView: null, statusView: null, hashView: null };
  return ErrorBoundary(view, ()=>{
    Html.replace(view, state.view = Html(['div.col.gap',
      ['div.chain.disabled.col.gap',
        ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to Bitcoin Mainnet'],
          ['strong.status', 'SOON']]],
      ['div.chain.disabled.col.gap',
        ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to Bitcoin Testnet'],
          ['strong.status', 'SOON']]],
      ['div.chain.disabled.col.gap',
        ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to regtest...'],
          ['strong.status', 'SOON']]],
      ['div.chain.disabled.col.gap',
        ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to Liquid Mainnet'],
          ['strong.status', 'SOON']]],
      ['div.chain.active.col.gap',
        ['div.row.gap.align-center.justify-start',
          ['strong.status', chain ? Texts.CONNECTING : Texts.CONNECTED],
          ['h3.name', 'Liquid Testnet'],
          ['div.grow'],
          ['div.row.gap', ['div', 'Height: '], ['strong.height']]]],
      ['div.chain.disabled.col.gap',
        ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to elementsregtest...'],
          ['strong.status', 'SOON']]],
      ['div.row.gap',
        ['div.chain.disableder.col.gap.grow',
          ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to Solana RPC...'],
            ['strong.status', 'SOON']]],
        ['div.chain.disableder.col.gap.grow',
          ['div.row.gap.align-center.justify-between', ['h3.name', 'Connect to Tendermint RPC...'],
            ['strong.status', 'SOON']]]]]).firstChild);
    state.hashView   = state.view.querySelector('.chain.active .hash')   as HTMLDivElement;
    state.heightView = state.view.querySelector('.chain.active .height') as HTMLDivElement;
    state.statusView = state.view.querySelector('.chain.active .status') as HTMLDivElement;
    state.statusView.style.color = '#af8';
    state.statusView.innerText   = Texts.CONNECTED;
    return ChainList.update(state)
  });
}
export interface ChainList {
  view:       Node
  statusView: HTMLElement
  heightView: HTMLElement
  hashView:   HTMLElement
  interval:   number
  nextUpdate: ReturnType<typeof setTimeout>
}
export namespace ChainList {
  export const update = async function updateChainList (state: ChainList) {
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
}
/** Generate and display test wallets. */
export function UserList (view = Html.id('users'), {
  users = [
    User.add('Alice', { secret: nonSecret(1) }),
    User.add('Bob',   { secret: nonSecret(2) }),
    User.add('Carol', { secret: nonSecret(3) })
  ]
} = {}) {
  return ErrorBoundary(view, () => {
    for (const user of users) Html.append(view, user.view());
    for (const select of User.findPickers()) User.initPicker(select, users);
    return { view, users }
  });
}
/** Create and dispay a user card. */
export function User (name: string, {
  secret   = new Uint8Array(Array(32).fill(1)),
  signer   = Wasm.keypair(secret),
  pubkey   = pubECDSA(secret),
  pubkeyX  = signer.xOnlyPublicKey(),
  //chain    = { bech32: 'ert', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, },
  chain    = { bech32: 'tex', blech32: 'tlq', pubKeyHash: 36, scriptHash: 19, wif: 0xef, },
  p2wpkh   = P2WPKH(pubkey, chain).address,
  output   = Html(['div.log', 'Enter Bob, Carol.']),
  //p2p      = P2P({ name, root: output }),
  balance  = Html(['span.balance', 'Loading balance...']).firstChild,
  toolbar  = Html(['section.progs', ['button.pill', 'Send'], ['button.pill', 'P2PK'], ['button.pill', 'Vault'], ['button.pill', 'Escrow'], ['input.chat', { placeholder: 'chat' }], ['button.pill', 'Say']]),
  identity = Html(['section.meta',  ['div.col.gap', ['div.row.gap.align-center', ['strong.name', name], ['div.col.gap', p2wpkh, ['strong', balance]]]]]),
  //identity = Html`(section.meta (.col.gap (.row.gap.align-center (strong.name ${name}) (.col.gap p2wpkh (strong ${balance})))))`,
  view     = () => Html(['div.col', ['article.user', identity, output, toolbar]])
} = {}): User {
  getBalances(p2wpkh).then(value => balance.innerText = `${value} sats`);
  return { name, signer, pubkey, pubkeyX, p2wpkh, view }
}
/** User model. */
export interface User {
  /** Human-friendly name. */
  name:    string
  /** Main address of user. */
  p2wpkh:  string
  /** Public key of user. */
  pubkey:  Uint8Array
  /** X-Only (tweaked?) public key of user. */
  pubkeyX: Uint8Array
  /** Can sign data with hidden secret key of user. */
  signer:  ReturnType<typeof Wasm.keypair>
  /** Render the user card. */
  view (): DocumentFragment
}
/** User-related functions. */
export namespace User {
  export const add = function addUser (...[name, options]: Parameters<typeof User>): User {
    if (usersByName[name]) throw new Error(`user already exists: ${name}`);
    const user = User(name, options)
    const pubkey = Base16.encode(user.pubkey)
    if (usersByPubkey[pubkey]) throw new Error(`pubkey already exists: ${name}: ${pubkey}`)
    usersByName[name] = user;
    usersByPubkey[pubkey] = user;
    return user;
  }
  export const findPickers = function findUserPickers (): HTMLSelectElement[] {
    return document.querySelectorAll('select.pick-user') as unknown as HTMLSelectElement[]
  }
  export const initPicker = function initUserPicker (select: HTMLSelectElement, users: User[]) {
    select.innerHTML = '';
    for (const user of users) {
      const label = ` (${user.p2wpkh})`;
      const value = Base16.encode(user.pubkey);
      select.appendChild(Html(['option', { value }, ['strong', user.name], label]));
    }
    if (select.onchange) select.onchange(null);
  }
}
export async function EditableProgram (name: string, source: string) {
  source = source.split('\n').map((line, index)=>(index > 0)?line.slice(2):line).join('\n');
  const view = (host: HTMLElement = document.createElement('div')) =>
    Html.replace(host, Html(ProgramEditor(`src/${name}.simf`, source, true)));
  return { name, source, view }
}
function ProgramEditor (id: string, source: string, open = false) {
  const errors   = Html(['pre.compile-errors.collapsible']).firstChild as HTMLElement;
  const sender   = Select.Sender();
  const params   = Object.entries(Wasm.params(source)).map(([name, type])=>{
    if (type === 'u256') return Select.Pubkey({ name: `Parameter: ${name}` }).view;
    if (type === 'u32')  return Input.Amount(`Parameter: ${name}`);
    console.warn('param', name, type);
  });
  console.log({params});
  const compiler = Wasm.compiler({ chain: chain.ID, genesis: chain.GENESIS });
  //onst program = compiler.compile(source, { args });
  //const params   = [Select.Pubkey({ name: 'Parameter: PUB' }).view];
  const button   = Button.Compile({ source, compiler, errors }).view
  const stage1   = SimfDemo.Form('simf-compile', Select.Chain(), ...params, button);
  const amount   = Label('Amount:', ['input.balance[type="number"]', { value: '2345' }]);
  const commit   = Button.Commit().view;
  const stage2   = SimfDemo.Form('simf-commit', sender.select, ['div.row', amount, sender.balance], commit);
  return Field(id)
    .open(open)
    .content(Field.TextArea(id, source))
    .content(errors)
    .sidebar(['div.phase-form', stage1])
    .sidebar(['div.phase-form', stage2])
    .build()
}
/** Wrap a SimplicityHL program as a standalone Deno executable. */
function SimfTS (source: string) {
  return `#!/usr/bin/env -S deno run -P default\nimport { SimplicityHL } from 'fadroma';\n` +
    `export default await SimplicityHL.Program(\`${source}\`).cli(import.meta)`;
}
export const ExamplePrograms = {
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
/** SimplicityHL example project and transaction runner. */
export function SimfDemo (view = Html.id("editors"), {
  nix      = true,
  btc      = true,
  simf     = true,
  elements = true,
  direnv   = true,
  deno     = true,
  node     = false,
} = {}) {
  return ErrorBoundary(view, { view: Html.replace(view, Html(
    ['div.editors',
      ['div.col',
        Section.Layer(['div', ['h2', 'Now with SimplicityHL Support!'], ...Texts.SIMPLICITYHL]),
        Programs(
          ExamplePrograms.P2PK.view(),
          ExamplePrograms.P2PKH.view(),
          ExamplePrograms.HodlVault.view()),
        Section.Phase('', SimfDemo.Instances())],
      ])) });
}
export namespace SimfDemo {
  export function Instances () {
    return ['div.row.gap.field.file',
      ['ul.instances', ['div.empty', ['strong', 'No deployed programs!'], ' Deploy a program using the above form.' ]],
      ['div.phase-form',
        SimfDemo.Form('simf-witness', Texts.WitnessTitle, Input.Balance(), Select.Recipient(),
          Label('Amount:', ['input[type="number"]', { value: '1234' }]), Input.SigHash()),
        SimfDemo.Form('simf-redeem', Texts.RedeemTitle, Select.Signer({ name: 'witness::SIG' }).view,
          Label('TX bytes:', ['input']), Label('Redeem TX:', Button('redeem')))],
    ]
  }
  export function Form (id, ...rest: unknown[]) {
    return [`div.program-form.col.grow#${id}`, ...rest];
  }
  export const init = function initEditors (el: Element) {
    //Html.id('title').focus();
    for (const textarea of el.querySelectorAll('#editor textarea')) initEditor({
      textarea: textarea as HTMLTextAreaElement
    });
  }
  function initEditor ({
    textarea = null as  HTMLTextAreaElement & { monaco?: Monaco.editor.ITextModel }
  } = {}) {
    Field.computeHeight(textarea);
    const content  = textarea.value;
    const language = textarea.dataset.language ??= 'nix';
    const uri      = textarea.dataset.uri ??= `fadroma://${+new Date()}`;
    const model    = textarea.monaco = Monaco.editor.createModel(content, language, Monaco.Uri.parse(uri));
    const wrapper  = Html.Div('.editor-wrapper');
    const editor   = Monaco.editor.create(wrapper, monacoOptions(language, model));
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
}
export function Programs (...args: unknown[]) {
  return Section({ className: 'layer programs col' }, ['div.files', ...args]);
}
/** A project repository. */
export function Project (...args: unknown[]) {
  return Section({ className: 'layer project' }, ['div.col.grow.files.gap',
    ['div', ['h2', 'Project template:'], Texts.DownloadProject],
    Project.Metadata(), Project.Readme(), Field.Text("Justfile", "TODO"), ...args ]);
}
export namespace Project {
  export const Readme = () =>
    ['div.col.gap', Field.Text("README",   "Created at https://fadroma.tech")];
  export const Metadata = () =>
    ['div.row.fields',
      ['div.field.head.grow', ['div.name.title', 'Title'], Input.Title()],
      ['div.field.head',      ['div.name', 'Licence'],     Select.License()],
      ['div.row.fields',      ['div.field.head.grow', ['div.name', 'Download']]]];
}
/** An ECMAScript (JS/TS) module. */
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
export function Nix ({ nix, elements }) {
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
export function Section (...content: unknown[]): DocumentFragment {
  return Html(['section', ...content]) as DocumentFragment;
}
export namespace Section {
  export const Layer    = (...args: unknown[]) => Section({ className: 'layer' }, ...args);
  export const Actions  = (...args: unknown[]) => Section({ className: 'layer actions' }, ...args);
  export const Phase    = (...args: unknown[]) => Section({ className: 'phase' }, ...args);
}
export function Label (text: string, ...content: unknown[]): HTMLLabelElement {
  return Html(['label', ['strong', text], ...content]).firstChild as HTMLLabelElement
}
export function Button (id: keyof typeof Button.Labels, onclick = () => {}): HTMLButtonElement {
  return Html(['button', Labels[id], { id, onclick }]).firstChild as HTMLButtonElement; // FIXME don't default to DocumentFragment
}
export namespace Button {
  export function Compile ({
    source   = null,
    chain    = Bitcoin.LiquidTestnet,
    genesis  = chain.GENESIS, // TODO autofetch from block 0
    compiler = Wasm.compiler({ chain: chain.ID, genesis }),
    button   = Button('compile', () => compile()),
    errors   = Html(['pre.compile-errors.collapsible']).firstChild as HTMLElement,
    input    = Html(['input', { placeholder: 'compile to get P2TR' }]).firstChild as HTMLInputElement,
    view     = Html(['label.col.gap.align-stretch', button, ['label.justify-between.gap', ['strong', 'Program address (P2TR):'], input], errors]).firstChild,
    compile  = async () => {
      //const { default: Wasm } = await import('./wasm.ts');
      errors.innerText = '';
      errors.style.display = 'none';
      try {
        const pubkeyValue = document.querySelector('#simf-compile .pubkey')?.value;
        const args        = { PUB: { type: 'Pubkey', value: `${pubkeyValue}` } };
        console.log({args});
        const program = compiler.compile(source, { args });
        const address = program.toJSON().p2tr;
        input.value = address;
        const balance = await getBalances(address);
        console.debug('Balance of', address, 'is', balance);
        document.querySelector('#simf-witness .balance').value = String(balance)
      } catch (e) {
        errors.innerText = e.stack;
        errors.style.display = 'block';
      }
    }
  } = {}) {
    return { view, compile }
  }
  export function Commit ({
    chain   = Bitcoin.LiquidTestnet,
    button  = Button('commit', () => commit()),
    view    = Html(['label', ['strong', 'Commit TX:'], button]).firstChild,
    genesis = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1',
    commit  = async () => {
      //const { default: Wasm } = await import('./wasm.ts');
      const compiler = Wasm.compiler({ chain: chain.ID, genesis });
      const program = compiler.compile(`fn main () {}`);
      const pubkey = document.getElementById('select-sender').value;
      const sender = usersByPubkey[pubkey];
      if (!sender) throw new Error(`not our pubkey: ${sender}`);
      const utxos = await chain().esplora.getAddressUtxos(sender.p2wpkh) as unknown[];
      if (utxos.length < 1) throw new Error(`fund the address first: ${sender.p2wpkh}`)
    },
  } = {}) {
    return { view, commit }
  }
  export function Command (icon: string|null, ...content: unknown[]) {
    return [ 'div.command', icon && Icon(icon), ...content ]
  }
}
export function Field (id: string, { open = false, header = [], content = [], sidebar = [] } = {}) {
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
  };
  export function TextArea (id: string, ...content: string[]) {
    return [`textarea.collapsible#text:${id}`,
      {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
      content.filter(x=>typeof x === 'string').join('\n')];
  }
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
    ['input#title[type=text]', { placeholder: 'name your project' }];
  export const Balance = () =>
    ['label.gap', ['strong', 'Balance:'], ['input.balance', { disabled: true }]]
  export const SigHash = () =>
    ['label.gap', ['strong', 'Sign hash:'], ['input']]
  export const Amount = (name = 'Amount:') =>
    ['label.gap', ['strong', name], ['input']]
}
export function Select () { /* TODO */ }
export namespace Select {
  export function Chain () {
    return ['label', ['strong', 'Chain:'], ['select.pick-chain', ['option', 'liquidtestnet'], ['option', { disabled: true }, 'elementsregtest']]];
  }
  export function Recipient () {
    return ['label', ['strong', 'Recipient:'], ['select.pick-user']]
  }
  export function Program ({
    view = Html(['label', ['strong', 'Program:'], ['select.pick-program',
      ['option', 'Nop'], ['option', 'AssertTrue'], ['option', 'AssertFalse'],
      ['option', {'selected': true}, 'P2PK'], ['option', 'P2PKH'], ['option', 'HodlVault']]]).firstChild
  } = {}) {
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
  export interface Sender extends Select.WithInput { balance: HTMLElement }
  export interface Pubkey extends Select.WithInput {}
  export interface Signer extends Select.WithInput {}
  export function Pubkey ({
    name = null as string,
    view = Html(['div.select-pubkey', { style: 'align-items:stretch' }, Label(name, ['select.pick-user']), ['input.pubkey']]),
    input = view.querySelector('input'),
    select = view.querySelector('select'),
    update = (state: Select.Pubkey) => { state.input.value = state.select.value; return state },
  }: Partial<Select.Pubkey> = {}): Select.Pubkey {
    const state = { name, view, select, input, update };
    select.onchange = () => { update(state); document.getElementById('compile').click() };
    return update(state);
  }
  export function Sender ({
    name    = 'Sender:',
    balance = Html(Input.Balance()).firstChild as HTMLElement,
    view    = Html(['div.col', { style: 'align-items:stretch' }, Label(name, ['select.pick-user']), balance]).firstChild as HTMLElement,
    input   = view.querySelector('input'),
    select  = view.querySelector('select'),
    update  = (state: Select.Sender) => { setTimeout(()=>updateSenderBalance(state), 1); return state },
  }: Partial<Select.Sender> = {}): Select.Sender {
    const state = { name, view, select, input, balance, update };
    select.onchange = () => update(state);
    return update(state);
  }
  async function updateSenderBalance ({ select, input }) {
    const pubkey = select.value;
    const sender = usersByPubkey[pubkey];
    if (sender) {
      input.value = String(await getBalances(sender?.p2wpkh));
    }
  }
  export function Signer ({
    name   = null as string,
    update = (state: Select.Pubkey) => { console.error('Select.Signer: provide sighash first!'); return state },
    view   = Html(['label', ['em', name], ['div.col.gap', ['select.pick-user'], ['input.signed']]]),
    select = Object.assign(view.querySelector('select'), { onchange: update }),
    input  = view.querySelector('input')
  }: Partial<Select.Signer> = {}) {
    return update({ name, view, select, input, update });
  }
  export function findUserPickers (): HTMLSelectElement[] {
    return document.querySelectorAll('select.pick-user') as unknown as HTMLSelectElement[]
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
  p2wpkh: string,
  chain = Bitcoin.LiquidTestnet(),
  asset: string = "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5"
): Promise<bigint> {
  let balance = 0n;
  const utxos = await chain.esplora.getAddressUtxos(p2wpkh);
  for (const utxo of utxos) if (utxo.asset === asset) balance += BigInt(utxo.value);
  return balance
}

export async function loadDocs (href: string) {
  const main = Html.id("main");
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

export const checked = (id: string) => !!(Html.id(id) as HTMLInputElement)?.checked;

export const textVal = (id: string) => (Html.id(id) as HTMLInputElement)?.value?.trim();

export const byteVal = (id: string) => (Html.id(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME

/** Displa error thrown by component init in host element. */
function ErrorBoundary (view: HTMLElement, callback) {
  try {
    return callback()
  } catch (error) {
    view.style.whiteSpace = 'pre';
    view.innerText = error.stack;
    return { view, error }
  }
}

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

export async function P2P ({
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
