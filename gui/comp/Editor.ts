import { pinSize, elById, textVal, download } from '../lib.ts';
import { Name, DOM } from '../../lib/index.ts';
import { zipStr } from '../../lib/deps.ts';
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
      '  let oracle_height: u32 = witness::ORACLE_HEIGHT;',
      '  let oracle_price:  u32 = witness::ORACLE_PRICE;',
      '  let oracle_sig: Signature = witness::ORACLE_SIG;',
      '  let owner_sig:  Signature = witness::OWNER_SIG;',
      '}'),
  ],

  Esm: ({ btc = false, simf = false, deno = false } = {}) => [

    Fields.TS("index.ts",
      (btc||simf)&&`import { ${
        [btc  && 'Btc'
        ,simf && 'Simf'
        ].filter(Boolean).join(', ')
      } } from '../lib/index.ts';`,
      `export async function deploy () {}`),

    Fields.TSTest("test.ts",
      `import { Test, Btc, Simf } from '../lib/index.ts';`,
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
      `    "vite": "*"`,
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
      `    "isolatedModules":            false,`,
      `  }`,
      `}`,
    ),
    deno && Fields.Text("deno.json", "{}"),
    deno && Fields.TS("deps.ts", ' '),
  ],

  Env: ({ btc = false, simf = false, nix = false, direnv = false } = {}) => [
    nix && Fields.Text("shell.nix",
      `{pkgs ? import<nixpkgs> {} }: pkgs.mkShell {`,
      `  nativeBuildInputs = [`,
      btc  && `    pkgs.bitcoind`,
      simf && `    # TODO: simc package`,
      `  ];`,
      `}`),
    direnv && Fields.Text(".envrc", "use nix"),
  ],

})
