import { pinSize, elById, textVal, download } from '../lib.ts';
import { Name, DOM } from '../../lib/index.ts';
import { zipSync, zipStr } from '../../lib/deps.ts';
import { Field } from './Field.ts';
import { Fields } from './Fields.ts';
export const Editor = Name('Editor', function initEditor (el = elById("editors"), {
  btc    = true,
  simf   = true,
  nix    = true,
  direnv = true,
} = {}) {
  pinSize(el, () => {
    el.innerHTML = '';
    el.appendChild(DOM(...Editor.Info()));
    el.appendChild(DOM(...Editor.Simf()));
    el.appendChild(DOM(...Editor.Esm({ btc, simf })));
    el.appendChild(DOM(...Editor.Env({ btc, simf, nix, direnv })));
  });
  el.querySelectorAll('textarea').forEach(Field.computeHeight);
  return el
}, {
  update (e: InputEvent) {
    let target = e.target as HTMLElement;
    do {
      if (target?.id?.startsWith('enable:')) {
        console.log(target.id);
        return;
      }
      target = target.parentElement;
    } while (target && target !== e.currentTarget);
  },
  load () {
  },
  save () {
    const title   = textVal('title') || 'fadroma';
    const license = textVal('license');
    const archive = {};
    elById("editors").querySelectorAll('[data-path]').forEach((el: HTMLElement)=>{
      archive[el.dataset.path] = zipStr(el.querySelector('textarea')?.value);
    });
    const makeExecutable = (x: string) => {
      if (archive[x]) archive[x] = [archive[x], { os: 3, attrs: 0o755 << 16 }];
    };
    makeExecutable('test.ts');
    makeExecutable('shell.nix');
    download(`${+new Date()}-${title}.zip`, 'application/zip', zipSync(archive))
  },

  Info: () => [
    ['div.row.gap.fields',
      ['div.field.grow',
        ['div.name', 'Title'],
        ['input#title[type=text][focused=focused]', {
          placeholder: 'name your project'
        }]],
      ['div.field',
        ['div.name', 'Licence'],
        ['select#licence',
          ['option', 'AGPL 3.0 or later'],
          ['option', 'AGPL 3.0 only'],
          ['option', 'GPL 3.0 or later'],
          ['option', 'GPL 3.0 only'],
          ['option', 'Closed source (inquire)']]]],

    Fields.Text("README",
      "Created at https://fadroma.tech"),
  ],

  Simf: () => [
    Fields.Witness("src/main.wit", ' '),
    Fields.Text("src/main.simf", 'fn main () {',
      '}'),
  ],

  Esm: ({
    btc  = false,
    simf = false,
    deno = false,
    vite = false,
  } = {}) => [

    Fields.TS("index.ts",
      ESImport("../lib/index.ts", btc && 'Btc', simf && 'Simf'),
      `export async function deploy () {}`),

    Fields.TSTest("test.ts",
      deno
        ? `#!/usr/bin/env -S deno run -I --coverage --allow-env --allow-run --allow-net`
        : `#!/usr/bin/env -S npx tsx`,
      ESImport("../lib/index.ts", 'Test', btc && 'Btc', simf && 'Simf'),
      `import { deploy } from './index.ts';`,
      `export default Test.suite(import.meta, "Test",`,
      `  Test.the("Deploy", deploy),`,
      `  Test.the("Invoke"));`),

    Fields.Text("package.json",
      `{`,
      `  "name":    "untitled",`,
      `  "type":    "module",`,
      `  "main":    "index.ts",`,
      `  "version": "0.1.0",`,
      `  "licence": "AGPL-3.0-or-later",`,
      `  "dependencies": {`,
      `    "@hackbg/fadroma": "*"`,
      `  },`,
      `  "devDependencies": {`,
      vite && `    "vite": "*"`,
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
    deno && Fields.TS("deps.ts", ' '),
  ],

  Env: ({
    direnv  = false,
    nix     = false,
    btc     = false,
    simf    = false,
    element = false,
  } = {}) => [
    nix && Fields.Text("shell.nix",
      `#!/usr/bin/env nix-shell`,
      `{ pkgs ? import<nixpkgs> {} }: let`,
      `  # Build Rust package.`,
      `  rs = p: (pkgs.rustPlatform.buildRustPackage p);`,
      `  # Fetch source from GitHub.`,
      `  gh = owner: repo: rev: sha256:`,
      `    pkgs.fetchFromGitHub { inherit owner repo rev sha256; };`,
      `  # Build Rust package from GitHub.`,
      `  rs-gh = owner: pname: version: sha256: cargoHash: (rs rec {`,
      `    inherit pname version cargoHash;`,
      `    src = gh owner pname version sha256;`,
      `    nativeBuildInputs = [pkgs.pkg-config];`,
      `    PKG_CONFIG_PATH = "\${pkgs.openssl.dev}/lib/pkgconfig";`,
      `  });`,
      ``,
      `in pkgs.mkShell { nativeBuildInputs = [`,

      ...(btc
        ? [ `  pkgs.bitcoind` ]
        : []),

      ...(simf
        ? [ `  (rs-gh "starkware-bitcoin" "simply" "3e1d0589"`
          , `    "sha256-EKfeEsr/sG/SorT2GK/ovMvI2QaoTMZ1wehbCcSjEmQ="`
          , `    "sha256-N2i5IJtKU1iPkpBaX90LgA7gw8B3n+K5hbByJOMRV3o=")` ]
        : []),

      ...(element
        ? [ `  (pkgs.elementsd.overrideAttrs (_: {`,
          , `     version = "liquid-testnet-2024-10-08";`,
          , `     src = pkgs.fetchFromGitHub {`,
          , `       owner = "ElementsProject";`,
          , `       repo = "elements";`,
          , `       rev = "f957d3cde17c85afb18c6747f9c0b4fcb599f19a";`,
          , `       sha256 = "sha256-XzdfbrQ7s4PfM5N00oP1jo5BNmD4WUMUe79QsTxsL4s=";`,
          , `    };`,
          , `    withWallet = true;`,
          , `    withGui = false;`,
          , `    doCheck = false; }))` ]
        : []),

      `]; }`),
    direnv && Fields.Text(".envrc", "use nix"),
  ],

});

const ESImport = (mod: string, ...items: (string|false|null)[]) => {
  items = items.filter(x=>(typeof x === 'string'))
  if (items.length > 0) {
    return `import { ${items.join(', ')} } from "${mod}";`
  } else {
    return ''
  }
}
