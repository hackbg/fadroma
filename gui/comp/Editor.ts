import Html from '../../library/Html.ts';
import { zipSync, strToU8 as zipStr } from 'fflate';
import * as Monaco from 'monaco-editor';
import { Icon, elById, textVal, download } from '../lib.ts';
import Field   from './Field.ts';
import ES      from './ES.ts';
import Nix     from './Nix.ts';
import Command from './Command.ts';

let simf = null;

export default Editor;

function Editor (el = elById("editors"), {
  btc     = true,
  element = true,
  simf    = true,
  nix     = true,
  direnv  = true,
  node    = true,
  deno    = true,
  //vite =    false,
} = {}) {
  el.innerHTML = '';
  setTimeout(()=>initEditor(el), 1);
  Html.append(el, Html(['div.box.editors.col.grow.gap.justify-between',
    Simf.Programs({ nix, btc, simf, element, direnv, deno, node })]));
  return el
}

namespace Input {
  export const Title = () =>
    ['input#title[type=text][focused=focused]', { placeholder: 'name your project' }];
}

namespace Select {
  export const License = () => [
    'select#licence', // Free software licensing helps the software stay free.
    ['option', 'AGPL 3.0 or later'],
    ['option', 'AGPL 3.0 only'],
    ['option', 'GPL 3.0 or later'],
    ['option', 'GPL 3.0 only'],
    ['option', 'Closed source (inquire)']];
}

namespace Editor {

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

  export function load () {
  }

  export function save () {
    const title   = textVal('title') || 'fadroma';
    const license = textVal('license');
    const archive = {};
    elById("editors").querySelectorAll('[data-path]').forEach((el: HTMLElement)=>{
      archive[el.dataset.path] = zipStr(el.querySelector('textarea')?.value);
    });
    const makeExecutable = (x: string) => {
      if (archive[x]) archive[x] = [archive[x], { os: 3, attrs: 0o755 << 16 }];
    };
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
    makeExecutable('index.ts');
    makeExecutable('test.ts');
    makeExecutable('shell.nix');
    download(`${+new Date()}-${title}.zip`, 'application/zip', zipSync(archive))
  }
}

function initEditor (el: Element) {
  elById('title').focus();
  el.querySelectorAll('textarea').forEach(textarea=>{
    Field.computeHeight(textarea);
    const content  = textarea.value;
    const language = textarea.dataset.language ??= 'nix';
    const uri      = textarea.dataset.uri ??= `fadroma://${+new Date()}`;
    const model    = Monaco.editor.createModel(content, language, Monaco.Uri.parse(uri));
    const wrapper  = Html.Div('.editor-wrapper');
    const editor   = Monaco.editor.create(wrapper, {
      language,
      model:                   textarea.monaco = model,
      scrollBeyondLastLine:    false,
      wordWrap:                'on',
      wrappingStrategy:        'advanced',
      automaticLayout:         true,
      minimap:                 { enabled: false },
      overviewRulerLanes:      0,
      scrollbar:               {
        alwaysConsumeMouseWheel: false,
        ignoreHorizontalScrollbarInContentHeight: true,
        horizontal: 'hidden',
        vertical: 'auto',
      },
    });
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
export function Simf (id: string, ...content: string[]) {
  return Field({
    id,
    header: [
      Command('play', 'Compile', { onclick: simfCompile(id) }),
      //Command('circle-with-plus', 'Define')
    ],
    content: [
      Field.TextArea(id, ...content),
      [`div.row#result:${id}`, ['div.grow']],
      [`div.row.simf-result`, ['strong', `P2TR: `],
        [`div.grow#commit:${id}`, `(not compiled)`],
        ['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]],
      [`div.row.simf-result`, ['strong.w', `Sighash: `],
        [`div.grow#cmr:${id}`, `(not generated)`],
        ['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]],
    ] })
}
export namespace Simf {
  export const Programs = ({ nix, btc, simf, element, direnv, deno, node }) => ['div.col',
    ['section.layer', ...Description],
    ['section.layer.programs',
      ['p.sidebox', 'Try these ', ['strong', 'SimplicityHL programs'], ' on Liquid Testnet using the lifecycle controls below:'],
      ['div.col.grow.files.gap', P2PKTS(), P2PKHTS(), HodlVaultTS(), EscrowTS()]],
    ['section.layer.actions',
      ['p.sidebox', 'This is the ', ['strong', 'Simplicity transaction lifecycle'], '. Select a program, then fill in the inputs to see it in action!'],
      ['div.col.gap', CompileForm(), CommitForm()], RedeemForm()],
    ['section.layer.project',
      ['p.sidebox', 'Here you can ', ['strong', 'download an example project'], ' containing the above programs, ',
        'so that you can continue building in your preferred development environment.'],
      ['div.col.grow.files.gap',
        ['div.row.fields.gap',
          ['div.field.head.grow', ['div.name.title', 'Title'], Input.Title()],
          ['div.field.head',      ['div.name', 'Licence'],     Select.License()],
          ['div.row.fields',      ['div.field.head.grow', ['div.name', 'Download']]]],
        ['div.col.gap',
          Field.Text("README",   "Created at https://fadroma.tech")],
      ['section.layer',
          ['p.smol', ['strong', 'Local dev dependencies'], ' can be provided by Nix and Direnv (or bring your own Deno, Just and Elements.).'],
          //ES.DenoJsonField(deno),
          //PackageJsonField({ node, vite }),
          //TsConfigField(),
          direnv && Field.Text(".envrc", "use nix"),
          Nix({ nix, btc, simf, element }),
        ],
      ['section.layer',
          ['p.smol', ['strong', 'Fast integration testing'], ' on ', ['code', 'elementsregtest'],
            ' and ', ['code', 'liquidtestnet'], ' out of the box:'],
          Field.Text("Justfile", "TODO"),
          ES.TestSuite({ deno, node, btc })]
          ]]];
  const Description = [
    ['p', ['strong', 'Fadroma V3'], ' employs WebAssembly to instantly compile, evaluate, and deploy ', ['strong', 'SimplicityHL smart contracts'], ' from all modern JavaScript-based environments alike: browsers, servers, and edge services.']];
  const ProgramForm = (name: string, ...rest: unknown[]) =>
    ['div.program-form.col', ['div.title', name], ...rest];
  const CompileForm = () => ProgramForm(['span', ['strong', ['span', { style: 'float:left;font-size:2rem;padding-right:0.33rem' }, '1. '], 'Compile source code'], ' to P2TR address:'],
    ['label', ['strong', 'Chain:'],   ['select', ['option', 'liquidtestnet']]],
    ['label', ['strong', 'Program:'], ['select', ['option', 'P2PK']]],
    ['label', ['em', 'param::', 'PUB'],        ['input']],
    ['label', ['strong', 'P2TR:'],  ['button', 'Compile',]]);
  const CommitForm = () => ProgramForm(['span', ['strong', ['span', { style: 'float:left;font-size:2rem;padding-right:0.33rem' }, '2. '], 'Commit on-chain'], ' by funding that address:'],
    ['label', ['strong', 'Sender:'],      ['select', ['option', 'Alice']]],
    ['label', ['strong', 'Amount:'],      ['input']],
    ['label', ['strong', 'Commit TXID:'], ['button', 'Commit']]);
  const RedeemForm = () => ProgramForm(['span', ['strong', ['span', { style: 'float:left;font-size:2rem;padding-right:0.33rem' }, '3. '], 'Redeem funds'], ' by fulfilling the program\'s conditions:'],
    ['label', ['strong', 'Recipient:'],         ['select', ['option', 'Bob']]],
    ['label', ['em', 'witness::SIG'],           ['input']],
    ['label', ['strong', 'Sign hash:'],         ['input']],
    ['label', ['strong', 'Signer:'],            ['select', ['option', 'Carol']]],
    ['label', ['strong', 'Witness signature:'], ['input']],
    ['label', ['strong', 'TX bytes:'],          ['input']],
    ['label', ['strong', 'Redeem TXID:'],       ['button', 'Redeem',]]);
  export const P2PKTS      = () => ES("programs/P2PK.simf.ts",   SimfTS(P2PK));
  export const P2PKHTS     = () => ES("programs/P2PKH.simf.ts",  SimfTS(P2PKH));
  export const EscrowTS    = () => ES("programs/Escrow.simf.ts", SimfTS(Escrow));
  export const HodlVaultTS = () => ES("programs/Vault.simf.ts",  SimfTS(HodlVault));
  const SimfTS = (x: string) => `#!/usr/bin/env -S deno run\nimport { simf } from 'fadroma';\nexport default simf\`${x}\``;
  export const OracleForm = () => Witness("oracle.wit", 
    WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
    WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
    WitnessRow('sig', 'ORACLE_SIG',    ''),
    WitnessRow('sig', 'OWNER_SIG',     ''));
  export const OracleTS = () => ES("oracle.ts",
    ES.HashBang({ deno, node }),
    ES.Import("@hackbg/fadroma", simf && 'Simf'),
    simf && `export default Simf(import.meta, "src/main.simf");`);
  export const Witness = (id: string, ...content: unknown[]) => Field({
    id, collapsed: true, header: [
      ['select', ['option', 'src/main.simf']],
      Command('play', 'Satisfy', { onclick: simfCompile(id) }),
    ], content: [['div.col.collapsible',
      WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      WitnessRow('sig', 'ORACLE_SIG',    ''),
      WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], Command('circle-with-plus', 'Witness')]]] });
  export const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    ['div.witness',
      ['input[type=text].grow', { value: k, placeholder: 'name' }],
      ['label', ['select', ['option', { value: t }, t]]],
      ['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      Command('circle-with-cross', 'Remove')];

  export const SimfFn = (name: string, ...content: unknown[]) =>
    ['div.col.fn',
      ['div.row.align-center',
        ['strong.keyword', 'fn '],
        [`input[type=text][size=${name.length-2}]`, { value: name }],
        '(', [`input[type=text][size=2]`], ')',
        ' { ',
        ['div.grow'],
        Command('circle-with-cross', 'Remove')],
      ['textarea', content.join('\n')||' '], '}'];

  const P2PK = `fn main () {
  jet::bip_0340_verify((param::PK, jet::sig_all_hash()), witness::SIG)
}`;
  const P2PKH = `fn main () {
  let hasher: Ctx8 = jet::sha_256_ctx_8_init();
  let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, witness::PUB);
  let hash:   u256 = jet::sha_256_ctx_8_finalize(hasher)
  assert!(jet::eq_256(hash, param::PKH));
  jet::bip_0340_verify((witness::PUB, jet::sig_all_hash()), witness::SIG)
}`;
  const Escrow = `#!/usr/bin/env -S deno run\nimport { simf } from 'fadroma/simf';
export default simf\`/*TODO*/\``;
  const HodlVault = `#!/usr/bin/env -S deno run\nimport { simf } from 'fadroma/simf';
export default simf\`fn main () {
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

function simfCompile (id) {
  return async e => {
    simf ??= await import('../../platform/SimplicityHL/pkg/fadroma_simf.js')
    console.log(e.target)
    const resp = await fetch('/wasm/simf.wasm');
    const wasm = await resp.bytes();
    console.log({simf, resp, wasm});
    console.log(await simf.default(wasm));
    const result = simf.build('fn main () {}', {});
    console.log({result});
    elById(`result:${id}`).style.whiteSpace = 'pre';
    elById(`commit:${id}`).innerText = result.commit;
    elById(`cmr:${id}`).innerText = result.cmr;
    elById(`amr:${id}`).innerText = result.amr;
    elById(`ihr:${id}`).innerText = result.ihr;
  }
}

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
