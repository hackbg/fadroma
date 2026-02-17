import { zipSync, strToU8 as zipStr } from 'fflate';
import * as Monaco from 'monaco-editor';

import { Bytes } from '../../library/Byte.ts';
import Html from '../../library/Html.ts';

import { Link, Icon, elById, textVal, download } from '../lib.ts';
import { on } from '../lib.ts';
import { urls } from '../urls.ts';

export function Config (
  sidebar  = elById("sidebar"),
  features = elById("features"),
) {
  on(features, "change", Editor.update);
  Html.append(features, Html(['p', 'Current and planned platform support:',]));
  Html.append(features, Html(['div.row.gap', ['ul.features',

    Config.Section({
      open: false,
      name: 'Bitcoin ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/240',
      features: [
        [true, 0, "enable:btc",      "Bitcoin",
          ["Develop and test with local bitcoind in ", Link(urls.btcTest, "regtest"), " mode."],
          ["RPC", urls.btcRpc]],
        [true, 0, "enable:elements", "Elements",
          ["Develop and test with local elementsd in ", Link(urls.btcTest, "regtest"), " mode."],
          ["RPC", urls.btcRpc]],
        [true, 0, "enable:simf",     "SimplicityHL",
          ["Compile and run ", Link(urls.simfRef, "SimplicityHL"), " programs."],
          ["Language", urls.simfRef],
          ["Jets", urls.simfJets]]
      ]
    }),

    Config.Section({
      open: false,
      name: 'Solana ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/237',
      features: [
        [false, 0, "enable:sol", "Solana", "Client for Solana.",
          ["Web3",   urls.solanaWeb3],
          ["Kit",    urls.solanaKit],
          ["Codama", urls.codama]],
        [false, 1, "enable:sol-prog", "Solana Rust",
          "Write programs for Solana.",
          ["Core",   urls.solanaCrate]],
        [false, 1, "enable:sol-prog", "Solana Anchor",
          "Framework for Solana programs.",
          ["IDL",    urls.idlGuide],
          ["Anchor", urls.anchorCrate]],
      ]
    }),

    Config.Section({
      open: false,
      name: 'Cosmos ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/238',
      features: [
        [false, 0, "enable:tm", "Tendermint",
          "Client for Tendermint and compatibles."],
        [false, 1, "enable:namada", "Namada",
          ["Client and decoder for ", Link(urls.namadaRepo, "Namada"), "."]],
        [false, 1, "enable:scrt", "Scrt",
          ["Client for ", Link(urls.scrtHome, "Secret"), "."]],
        [false, 1, "enable:cw", "CosmWasm",
          "Write contracts for the Cosmos ecosystem."],
      ]
    }),

  ], ['ul.features', 

    Config.Section({
      open: false,
      name: 'JS / TS / ECMAScript ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/239',
      features: [
        [true, 0, "enable:deno", "Deno",
          "Run on next-gen TS/JS runtime by default.",
          ["@std", urls.denoStd],
          ["API",  urls.denoApi]],
        [true, 0, "enable:node", "Node.js",
          ["Will use ", Link(urls.tsxNpm, "tsx"), " to run TypeScript."],
          ["API", urls.nodeApi]],
        [true, 0, "enable:pnpm", "PNPM",
          ["Recommended package manager."], ["Compare", urls.pnpmCompare]],
        [false, 0, "enable:eslint", "ESLint",
          "Static analyzer.", ["Config", urls.eslintConf]],
        [false, 0, "enable:vite",
          "Vite", "Build your front-end in the same repo."]
      ]
    }),

    Config.Section({
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

    Config.Section({
      open: false,
      name: 'DevOps / Unix ecosystem',
      help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
      features: [
        [true,  0, "enable:git",          "Git",
          "Automatically init Git repo in new project."],
        [true,  0, "enable:nix",          "Nix Shell",
          ["Obtain dependencies from ", Link(urls.nixPkgs, "nixpkgs")],
          ["Install", urls.nixInstall]],
        [true,  0, "enable:direnv",       "Direnv",
          ["Automatically load Nix shell when entering project directory."],
          ["Wiki", urls.direnvWiki]],
        [false, 0, "enable:editorconfig", "EditorConfig",
          "IDE-agnostic settings.",
          ["Spec", urls.edConfSpec]],
      ]
    }),

    Config.Section({
      open: false,
      name: 'CI / CD',
      help: 'https://github.com/hackbg/fadroma/discussions/categories/guides',
      features: [
        [false, 0, "enable:gha",          "GHA",
          "Config for GitHub Actions."],
        [false, 0, "enable:drone",        "Drone",
          "Config for Drone CI."],
        [false, 0, "enable:woodpecker",   "Woodpecker",
          "Config for Woodpecker CI."],
      ]
    }),

  ]]));
  return sidebar;
}

export namespace Config {
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
  depth: number, id: string, name = ``, description = `` as string|(unknown[]),
  ...links: [string, string?][]
) {
  return Html([`li.feature[data-depth=${depth}]`,
    ['div.row.between',
      [`label`, [`input[type=checkbox][checked=checked]`, { id }], name],
      Feature.Links(links)],
    ['p.grow', ...(typeof description === 'object')?description:[description]]
  ]);
}

export function Editor (el = elById("editors"), options = {}) {
  Html.append(el, Editor.create(options));
  setTimeout(()=>Editor.init(el), 1);
  return el
}

export function Field ({ id, collapsed = true, header = [], content = [] }) {
  return Field.Wrapper(id, collapsed, Field.Handle(id, collapsed),
    ['div.flex.col.grow', Field.Header(id, ...header), ...content]);
}

export function Command (icon: string|null, ...content: unknown[]) {
  return [ 'div.command', icon && Icon(icon), ...content ]
}

export namespace Editor {

  export const create = ({
    btc =     true,
    element = true,
    simf =    true,
    nix =     true,
    direnv =  true,
    node =    true,
    deno =    true,
    vite =    false,
  } = {}) => Html(
    ['div.row.fields',
      ['div.field.head.grow', ['div.name.title', 'Title'],
        ['input#title[type=text][focused=focused]', { placeholder: 'name your project' }]],
      ['div.field.head', ['div.name', 'Licence'],
        ['select#licence',
          ['option', 'AGPL 3.0 or later'],
          ['option', 'AGPL 3.0 only'],
          ['option', 'GPL 3.0 or later'],
          ['option', 'GPL 3.0 only'],
          ['option', 'Closed source (inquire)']]],
      ['div.row.fields',
        ['div.field.head.grow', ['div.name', 'Download']],
        ['div.field.head.grow', ['div.name', 'Examples']],
        ['div.field.head.grow', ['div.name', 'Clear']]]],
    ['div.box.editors',
      Fields.Text("README", "Created at https://fadroma.tech"),
      Fields.Simf("vault.simf", `/*
 * HODL VAULT
 *
 * Lock your coins until the Bitcoin price exceeds a threshold.
 *
 * An oracle signs a message with the current block height and the current
 * Bitcoin price. The block height is compared with a minimum height to prevent
 * the use of old data. The transaction is timelocked to the oracle height,
 * which means that the transaction becomes valid after the oracle height.
 */
fn checksig(pk: Pubkey, sig: Signature) {
    let msg: u256 = jet::sig_all_hash();
    jet::bip_0340_verify((pk, msg), sig);
}

fn checksigfromstack(pk: Pubkey, bytes: [u32; 2], sig: Signature) {
    let [word1, word2]: [u32; 2] = bytes;
    let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, word1);
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, word2);
    let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    jet::bip_0340_verify((pk, msg), sig);
}

fn main() {
    let min_height: Height = 1000;
    let oracle_height: Height = witness::ORACLE_HEIGHT;
    assert!(jet::le_32(min_height, oracle_height));
    jet::check_lock_height(oracle_height);

    let target_price: u32 = 100000; // laser eyes until 100k
    let oracle_price: u32 = witness::ORACLE_PRICE;
    assert!(jet::le_32(target_price, oracle_price));

    let oracle_pk: Pubkey = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798; // 1 * G
    let oracle_sig: Signature = witness::ORACLE_SIG;
    checksigfromstack(oracle_pk, [oracle_height, oracle_price], oracle_sig);

    let owner_pk: Pubkey = 0xc6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5; // 2 * G
    let owner_sig: Signature = witness::OWNER_SIG;
    checksig(owner_pk, owner_sig);
}`),
      Fields.Witness("oracle.wit", 
        Fields.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
        Fields.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
        Fields.WitnessRow('sig', 'ORACLE_SIG',    ''),
        Fields.WitnessRow('sig', 'OWNER_SIG',     '')),
      Fields.TS("oracle.ts",
        ES.HashBang({ deno, node }),
        ES.Import("@hackbg/fadroma", simf && 'Simf'),
        simf && `export default Simf(import.meta, "src/main.simf");`),
      Fields.TS("test.ts",
        ES.HashBang({ deno, node }),
        ES.Import("@hackbg/fadroma", btc && 'Btc', 'Test'),
        `import Program from './index.ts';`,
        `export default Test.suite(import.meta, Btc(`,
        `  Test.the("Build",    Program.build),`,
        `  Test.the("Deposit",  Program.deposit),`,
        `  Test.the("Withdraw", Program.withdraw)));`),
    //packageJsonField({ node, vite }),
    //tsConfigField(),
    denoField(deno),
    nixField({ nix, btc, simf, element }),
    direnv && Fields.Text(".envrc", "use nix"),
  ]);

  const nixField = ({ nix, btc, simf, element }) => nix && Fields.Text("shell.nix",
      `#!/usr/bin/env nix-shell`,
      `{ pkgs ? import<nixpkgs> {} }: let`,
      ``,
      `  # Build Rust package.`,
      `  rs = p: (pkgs.rustPlatform.buildRustPackage p);`,
      ``,
      `  # Fetch source from GitHub.`,
      `  gh = owner: repo: rev: sha256:`,
      `    pkgs.fetchFromGitHub { inherit owner repo rev sha256; };`,
      ``,
      `  # Build Rust package from GitHub.`,
      `  rs-gh = owner: pname: version: sha256: cargoHash: (rs rec {`,
      `    inherit pname version cargoHash;`,
      `    src = gh owner pname version sha256;`,
      `    nativeBuildInputs = [pkgs.pkg-config];`,
      `    PKG_CONFIG_PATH = "\${pkgs.openssl.dev}/lib/pkgconfig";`,
      `  });`,
      ``,
      `  # Override package attributes.`,
      `  over = pkg: attrs: pkg.overrideAttrs (_: attrs);`,
      ``,
      `in pkgs.mkShell { nativeBuildInputs = [`,

      ...(btc
        ? [ ``, `  pkgs.bitcoind` ]
        : []),

      ...(simf
        ? [ ``
          , `  pkgs.mcpp`
          , ``
          , `  (rs-gh "starkware-bitcoin" "simply" "3e1d0589"`
          , `    "sha256-EKfeEsr/sG/SorT2GK/ovMvI2QaoTMZ1wehbCcSjEmQ="`
          , `    "sha256-N2i5IJtKU1iPkpBaX90LgA7gw8B3n+K5hbByJOMRV3o=")` ]
        : []),

      ...(element
        ? [ ``
          , `  (over pkgs.elementsd {`
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

  const denoField = deno => deno && Fields.Text("deno.json", "{}");
  const packageJsonField = ({ node, vite }) => Fields.Text("package.json", `{`,
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
  const tsConfigField = () => Fields.Text("tsconfig.json", `{`,
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

  export const init = el => {
    elById('title').focus();
    el.querySelectorAll('textarea').forEach(textarea=>{
      Field.computeHeight(textarea);
      const content  = textarea.value;
      console.log({textarea, content});
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
    deno ? `#!/usr/bin/env -S deno run -I --coverage --allow-env --allow-run --allow-net\n` :
    node ? `#!/usr/bin/env -S npx tsx\n` :
    null;
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
}

export namespace Fields {

  export function TextArea (id: string, ...content: string[]) {
    return [`textarea.collapsible#text:${id}`,
      {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
      content.filter(x=>typeof x === 'string').join('\n')];
  }

  export const Text = (id: string, ...content: string[]) => Field({
    id, content: [Fields.TextArea(id, ...content)], });

  export const TS = (id: string, ...content: string[]) => Field({
    id, header: [
      Command('play', 'Check'), Command('play', 'Run')
    ], content: [
      Fields.TextArea(id, ...content) ], });

  export const Simf = (id: string, ...content: string[]) => Field({
    id, header: [
      Command('play', 'Compile', { onclick: simfCompile(id) }),
      //Command('circle-with-plus', 'Define')
    ], content: [
      Fields.TextArea(id, ...content),
      [`div.row#result:${id}`, ['div.grow']],
      [`div.row.simf-result`, ['strong', `P2TR: `],
        [`div.grow#commit:${id}`, `(not compiled)`],
        ['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]],
      [`div.row.simf-result`, ['strong.w', `Sighash: `],
        [`div.grow#cmr:${id}`, `(not generated)`],
        ['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]],
    ] });

  let simf = null
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

  export const Witness = (id: string, ...content: unknown[]) => Field({
    id, collapsed: true, header: [
      ['select', ['option', 'src/main.simf']],
      Command('play', 'Satisfy', { onclick: simfCompile(id) }),
    ], content: [['div.col.collapsible',
      Fields.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      Fields.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      Fields.WitnessRow('sig', 'ORACLE_SIG',    ''),
      Fields.WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], Command('circle-with-plus', 'Witness')]]] });

  export const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    ['div.witness',
      ['input[type=text].grow', { value: k, placeholder: 'name' }],
      ['label', ['select', ['option', { value: t }, t]]],
      ['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      Command('circle-with-cross', 'Remove')];

  export const Hex = (id: string, ...content: unknown[]) =>
    Html([`div.field.file.hex#${id}`,
      ['div.handle-v', { onclick: Field.toggle(id) },
        ['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
        ['div.grow']],
      ['div.flex.col.grow',
        ['div.flex.row',
          ['div.name',     { onclick: Field.toggle(id) }, id],
          ['div.handle-h', { onclick: Field.toggle(id) }]],
        Fields.HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        Fields.HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        Fields.HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        Fields.HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

  export const HexRow = (addr, bytes, chars) =>
    ['div.row.hex-row', addr, bytes, chars];
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
