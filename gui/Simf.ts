import { Arg } from '../platform/SimplicityHL/SimplicityHL.ts';
import Command from './Command.ts';
import Chain   from './Chain.ts';
import ES      from './ES.ts';
import Field   from './Field.ts';
import Icon    from './Icon.ts';
import Input   from './Input.ts';
import Nix     from './Nix.ts';
import Select  from './Select.ts';

let simf = null; // WASM handle (initialized once)

export default Simf;

function Simf ({ nix, btc, simf, elements, direnv, deno, node }) {
  const { Info, Programs, CompileForm, RedeemForm, Metadata, Readme } = Simf;
  return ['div.col.gap',
    ['section.layer',          Info[0]],
    ['section.layer.programs', Info[1], ['div.col.grow.files.gap', ...Programs()]],
    ['section.layer.actions',  Info[2], ['div.col.grow.gap',
      ['section',              Info[3], CompileForm()],
      ['section',              Info[4], RedeemForm()]]],
    ['section.layer.project',  Info[5], ['div.col.grow.files.gap',
      Metadata(),
      Readme(),
      Field.Text("Justfile", "TODO"),
      ES.TestSuite({ deno, node, btc }),
      ES.DenoJson({ deno }),
      Nix({ nix, btc, simf, elements }),
      direnv && Field.Text(".envrc", "use nix")]]];
}

namespace Simf {

  export const Programs = () => [
    P2PK.wrapped(),
    P2PKH.wrapped(),
    HodlVault.wrapped(),
  ];

  const SimfTS = (source: string, param = {}, witness = {}) =>
    `#!/usr/bin/env -S deno run -P default\nimport { SimplicityHL } from 'fadroma';\n`      +
    `export default SimplicityHL.Program('${source}', {\n`                                  +
    `  param:   ${JSON.stringify(param).split('\n').map(x=>'  '+x).join('\n').trim()},\n`   +
    `  witness: ${JSON.stringify(witness).split('\n').map(x=>'  '+x).join('\n').trim()},\n` +
    `  cli:     import.meta\n})`;

  namespace P2PK {
    export const wrapped = () => ES("src/P2PK.simf.ts", SimfTS(source,
      { PK: Arg("Pubkey") }, { "SIG": Arg("Signature") }));
    export const source = `fn main () {
  jet::bip_0340_verify((param::PK, jet::sig_all_hash()), witness::SIG)
}`;
  }

  namespace P2PKH {
    export const wrapped = () => ES("src/P2PKH.simf.ts", SimfTS(source,
      { "PKH": Arg("Pubkey") }, { "PUB": Arg("Pubkey"), "SIG": Arg("Signature") }));
    export const source = `fn main () {
  let hasher: Ctx8 = jet::sha_256_ctx_8_init();
  let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, witness::PUB);
  let hash:   u256 = jet::sha_256_ctx_8_finalize(hasher)
  assert!(jet::eq_256(hash, param::PKH));
  jet::bip_0340_verify((witness::PUB, jet::sig_all_hash()), witness::SIG)
}`;
  }

  namespace HodlVault {
    export const wrapped = () => Field("src/HodlVault.simf.ts")
      .open(true)
      .content(Field.TextArea("src/HodlVault.simf.ts", SimfTS(source,
        { "MIN_HEIGHT":   Arg("u32"), "TARGET_PRICE":  Arg("u32") },
        { "ORACLE_PRICE": Arg("u32"), "ORACLE_HEIGHT": Arg("u32") })))
      .build();
    export const source = `export default simf\`fn main () {
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

  export const Program = (id: string, ...content: string[]) => Field(id)
    .header(Command('play', 'Compile', { onclick: simfCompile(id) }))
    .header(Command('circle-with-plus', 'Define'))
    .content(Field.TextArea(id, ...content))
    .content([`div.row#result:${id}`, ['div.grow']])
    .content([`div.row.simf-result`, ['strong', `P2TR: `],
      [`div.grow#commit:${id}`, `(not compiled)`],
      ['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]])
    .content([`div.row.simf-result`, ['strong.w', `Sighash: `],
        [`div.grow#cmr:${id}`, `(not generated)`],
        ['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]])
    .build();

  const ProgramForm = (name: string|unknown[], ...rest: unknown[]) =>
    ['div.program-form.col.grow', ['div.title', name], ...rest];
  const CompileTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'A1. '], 'Obtain P2TR'],
    ' by compiling the program:'];
  const FundTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'A2. '], 'Transfer funds'],
    ' to the P2TR address:'];
  export const CompileForm = () => ['div.row.gap.grow',
    ProgramForm(CompileTitle,
      ['label', ['strong', 'Chain:'],     ['select', ['option', 'liquidtestnet']]],
      ['label', ['strong', 'Program:'],   ['select', ['option', 'P2PK']]],
      ['label', ['em', 'param::', 'PUB'], ['select', ['option', 'Alice']], ['input'], ],
      ['label', ['strong', 'Program address:'],  ['button', 'Compile',]]),
    ProgramForm(FundTitle,
      ['label', ['strong', 'Sender:'], ['select', ['option', 'Alice']]],
      ['label', ['strong', 'Amount:'], ['input']],
      ['label', ['strong', 'Transaction A:'], ['button', 'Commit']]),
  ];
  const WitnessTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'B1. '], 'Specify transaction'],
    ' to obtain SIGHASH_ALL:'];
  const RedeemTitle = ['span',
    ['strong', ['span', { style: 'float:left;font-size:1.5rem;padding-right:0.33rem' }, 'B2. '], 'Redeem funds'],
    ' by sending valid signatures:'];
  export const RedeemForm = () => ['div.row.gap.grow',
    ProgramForm(WitnessTitle,
      ['label', ['strong', 'Recipient:'], ['select', ['option', 'Bob']]],
      ['label', ['strong', 'Amount:'],    ['input']],
      ['label', ['strong', 'Sign hash:'], ['input']]),
    ProgramForm(RedeemTitle,
      ['label', ['em', 'witness::SIG'],            ['select', ['option', 'Carol']], ['input']],
      ['label', ['strong', 'Transaction bytes:'],  ['input']],
      ['label', ['strong', 'Transaction B:'], ['button', 'Redeem',]])
  ];
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
    .header(Command('play', 'Satisfy', { onclick: simfCompile(id) }))
    .content([['div.col.collapsible',
      WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      WitnessRow('sig', 'ORACLE_SIG',    ''),
      WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], Command('circle-with-plus', 'Witness')]]])
    .build();
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

  export const Readme = () =>
    ['div.col.gap', Field.Text("README",   "Created at https://fadroma.tech")];

  export const Metadata = () =>
    ['div.row.fields.gap',
      ['div.field.head.grow', ['div.name.title', 'Title'], Input.Title()],
      ['div.field.head',      ['div.name', 'Licence'],     Select.License()],
      ['div.row.fields',      ['div.field.head.grow', ['div.name', 'Download']]]];

  const Dropcap = (...content) =>
    ['span', { style: 'float:left;font-size:2rem;padding-right:0.33rem' }, ...content]

  export const Info = {
    0: ['p'
       , ['strong', 'Fadroma V3'], ' employs WebAssembly to instantly compile, evaluate, and deploy '
       , ['strong', 'SimplicityHL smart contracts'], ' from all modern JavaScript-based environments alike: browsers, servers, and edge services.'],
    1: ['p.sidebox.flex.space-between'
       , ['div.grow', 'Try these ', ['strong', 'SimplicityHL programs'], ' on ', ['a', { href: '#' }, 'Liquid Testnet:'], ' ']
       , Chain()],
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
    elById(`result:${id}`).style.whiteSpace = 'pre';
    elById(`commit:${id}`).innerText = result.commit;
    elById(`cmr:${id}`).innerText = result.cmr;
    elById(`amr:${id}`).innerText = result.amr;
    elById(`ihr:${id}`).innerText = result.ihr;
  }
}
