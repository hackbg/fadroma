import * as Monaco from 'monaco-editor';
import { Link, Icon, elById, textVal, download } from '../lib.ts';
import { Html } from '../../lib/index.ts';
import { zipSync, zipStr } from '../../lib/deps.ts';
import { Bytes } from '../../lib/index.ts';
import { on } from '../lib.ts';
import { urls } from '../urls.ts';

export function Config (
  el     = elById("sidebar"),
  elEnv  = elById('sidebar-env'),
  elBtc  = elById('sidebar-btc'),
  elEs   = elById('sidebar-es'),
  elRust = elById('sidebar-rust'),
  elSol  = elById('sidebar-sol'),
  elTm   = elById('sidebar-tm')
) {
  on(el, "change", Editor.update);
  Html.prepend(el, Html(['div.row.gap.fields',
    ['div.field.head.grow', ['div.name', 'Download']],
    ['div.field.head.grow', ['div.name', 'Examples']],
    ['div.field.head.grow', ['div.name', 'Clear']]]));
  Html.append(elEnv,  Html(['ul.features', ...Config.Env()]));
  Html.append(elBtc,  Html(['ul.features', ...Config.Btc()]));
  Html.append(elEs,   Html(['ul.features', ...Config.Ecma()]));
  Html.append(elRust, Html(['ul.features', ...Config.Rust()]));
  Html.append(elSol,  Html(['ul.features', ...Config.Sol()]));
  Html.append(elTm,   Html(['ul.features', ...Config.Tm()]));
  return el;
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

export namespace Config {
  export const Btc = () => [
    Feature(0, "enable:btc", "Bitcoin",
      ["Develop and test with local bitcoind in ", Link(urls.btcTest, "regtest"), " mode."],
      ["RPC", urls.btcRpc]),
    Feature(0, "enable:btc", "Elements",
      ["Develop and test with local elementsd in ", Link(urls.btcTest, "regtest"), " mode."],
      ["RPC", urls.btcRpc]),
    Feature(0, "enable:simf", "SimplicityHL",
      ["Compile and run ", Link(urls.simfRef, "SimplicityHL"), " programs with Simply."],
      ["Language", urls.simfRef],
      ["Jets", urls.simfJets]), ];
  export const Ecma = () => [
    Feature(0, "enable:deno", "Deno",
      "Run on next-gen TS/JS runtime by default.",
      ["@std", urls.denoStd],
      ["API",  urls.denoApi]),
    Feature(0, "enable:node", "Node.js",
      ["Will use ", Link(urls.tsxNpm, "tsx"), " to run TypeScript."],
      ["API", urls.nodeApi]),
    Feature(0, "enable:pnpm", "PNPM",
      ["Recommended package manager."],
      ["Compare", urls.pnpmCompare]),
    Feature.Disabled(0, "enable:eslint", "ESLint", "Static analyzer.",
      ["Config", urls.eslintConf]),
    Feature.Disabled(0, "enable:vite", "Vite", "Build your front-end in the same repo."), ];
  export const Env = () => [
    Feature(0, "enable:git", "Git",
      "Automatically init Git repo in new project."),
    Feature(0, "enable:nix", "Nix Shell",
      ["Obtain dependencies from ", Link(urls.nixPkgs, "nixpkgs")],
      ["Install", urls.nixInstall]),
    Feature(0, "enable:direnv", "Direnv",
      ["Automatically load Nix shell when entering project directory."],
      ["Wiki", urls.direnvWiki]),
    Feature.Disabled(0, "enable:editorconfig", "EditorConfig",
      "IDE-agnostic settings.",
      ["Spec", urls.edConfSpec]),
    Feature.Disabled(0, "enable:gha",   "GHA",
      "Config for GitHub Actions."),
    Feature.Disabled(0, "enable:drone", "Drone",
      "Config for Drone CI."), ];
  export const Rust = () => [
    Feature.Disabled(0, "enable:rust", "Rust",
      "Different targets may need different toolchains."),
    Feature.Disabled(1, "enable:mold", "Mold",
      "Improves build times."), ];
  export const Sol = () => [
    Feature.Disabled(0, "enable:sol", "Solana", "Client for Solana.",
      ["Web3",   urls.solanaWeb3],
      ["Kit",    urls.solanaKit],
      ["Codama", urls.codama]),
    Feature.Disabled(1, "enable:sol-prog", "Solana Rust",
      "Write programs for Solana.",
      ["Core",   urls.solanaCrate]),
    Feature.Disabled(1, "enable:sol-prog", "Solana Anchor",
      "Framework for Solana programs.",
      ["IDL",    urls.idlGuide],
      ["Anchor", urls.anchorCrate]), ];
  export const Tm = () => [
    Feature.Disabled(0, "enable:tm", "Tendermint",
      "Client for Tendermint and compatibles."),
    Feature.Disabled(1, "enable:namada", "Namada",
      ["Client and decoder for ", Link(urls.namadaRepo, "Namada"), "."]),
    Feature.Disabled(1, "enable:scrt", "Scrt",
      ["Client for ", Link(urls.scrtHome, "Secret"), "."]),
    Feature.Disabled(1, "enable:cw", "CosmWasm",
      "Write contracts for the Cosmos ecosystem."), ];
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
  } = {}) => Html(['div.box.editors',
    ['div.row.gap.fields',
      ['div.field.head.grow', ['div.name', 'Title'],
        ['input#title[type=text][focused=focused]', { placeholder: 'name your project' }]],
      ['div.field.head', ['div.name', 'Licence'],
        ['select#licence',
          ['option', 'AGPL 3.0 or later'],
          ['option', 'AGPL 3.0 only'],
          ['option', 'GPL 3.0 or later'],
          ['option', 'GPL 3.0 only'],
          ['option', 'Closed source (inquire)']]]],
    Fields.Text("README", "Created at https://fadroma.tech"),
    Fields.Simf("src/main.simf", 'fn main () {', '}'),
    Fields.Witness("src/main.wit", 
      Fields.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      Fields.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      Fields.WitnessRow('sig', 'ORACLE_SIG',    ''),
      Fields.WitnessRow('sig', 'OWNER_SIG',     '')),
    Fields.TS("index.ts",
      ESHashBang({ deno, node }),
      ESImport("@hackbg/fadroma", simf && 'Simf'),
      simf && `export default Simf(import.meta, "src/main.simf");`),
    Fields.TS("test.ts",
      ESHashBang({ deno, node }),
      ESImport("@hackbg/fadroma", btc && 'Btc', 'Test'),
      `import Program from './index.ts';`,
      `export default Test.suite(import.meta, Btc(`,
      `  Test.the("Build",    Program.build),`,
      `  Test.the("Deposit",  Program.deposit),`,
      `  Test.the("Withdraw", Program.withdraw)));`),
    Fields.Text("package.json",
      `{`,
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
    ),
    Fields.Text("tsconfig.json",
      `{`,
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
    ),
    deno && Fields.Text("deno.json", "{}"),
    direnv && Fields.Text(".envrc", "use nix"),
    nix && Fields.Text("shell.nix",
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

      `\n]; }`
  )]);

  export const init = el => el.querySelectorAll('textarea').forEach(textarea=>{
    Field.computeHeight(textarea);
    const model = Monaco.editor.createModel(textarea.innerText, 'nix', Monaco.Uri.parse(`fadroma://${+new Date()}`));
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-wrapper';
    const editor = Monaco.editor.create(wrapper, {
      model:    textarea.monaco = model,
      language: 'nix',
      theme:    'gruvbox-dark',
      automaticLayout: true,
    });
    textarea.parentElement.appendChild(wrapper);
    textarea.parentElement.removeChild(textarea);
  })

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

  const ESImport = (mod: string, ...items: (string|false|null)[]) => {
    items = items.filter(x=>(typeof x === 'string'))
    if (items.length > 0) {
      return `import { ${items.join(', ')} } from "${mod}";`
    } else {
      return ''
    }
  }

  const ESHashBang = ({ deno = false, node = false }) =>
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
  export const textarea = (id: string, ...content: string[]) =>
    [`textarea.collapsible#text:${id}`,
      {autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: false},
      content.filter(x=>typeof x === 'string').join('\n')];
  export const Text = (id: string, ...content: string[]) => Field({
    id, content: [Fields.textarea(id, ...content)], });
  export const TS = (id: string, ...content: string[]) => Field({
    id, collapsed: false, header: [
      Command('play', 'Check'), Command('play', 'Run')
    ], content: [
      Fields.textarea(id, ...content) ], });
  export const Simf = (id: string, ...content: string[]) => Field({
    id, collapsed: false, header: [
      Command('play', 'Compile', { onclick: () => console.log('boo') }),
      //Command('circle-with-plus', 'Define')
    ], content: [
      Fields.textarea(id, ...content),
      ['div.row', ['div.grow']] ] });
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
    id, collapsed: false,
    content: [['div.col.collapsible',
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
