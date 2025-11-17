import { DOM } from '../lib/index.ts';
import { elById, append } from './lib.ts';

export function initEditors (el = elById("editors")) {
  append(el, 
    TextField("README",
      "Created at https://fadroma.tech"),
    TextField("src/main.simf",
      ' '),
    HexField("src/main.wit",
      ' '),
    TextField("index.ts",
      `import { Btc, Simf } from '../lib/index.ts';`,
      `export async function deploy () {}`),
    TextField("test.ts",
      `import { Test, Btc, Simf } from '../lib/index.ts';`,
      `import { deploy } from './index.ts';`,
      `export default Test.suite(import.meta, "Test",`,
      `  Test.the("Deploy", deploy),`,
      `  Test.the("Invoke"));`),
    TextField("package.json",
      `{`,
      `  "name": "",`,
      `  "type": "module",`,
      `  "main": "index.ts",`,
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
    TextField("tsconfig.json",
      `{`,
      `  "strict": false,`,
      `  "target": "esnext",`,
      `  "module": "esnext",`,
      `  "moduleResolution": "bundler",`,
      `  "allowImportingTsExtensions": true,`,
      `  "noUnusedLocals": false,`,
      `  "noUnusedParameters": false,`,
      `  "isolatedModules": false,`,
      `}`,
    ),
    TextField("deno.json", "{}"),
    TextField("deps.ts", ' '),
    TextField("shell.nix",
      `{pkgs ? import<nixpkgs> {} }: pkgs.mkShell {`,
      `  nativeBuildInputs = [`,
      `    pkgs.bitcoind`,
      `  ];`,
      `}`),
    TextField(".envrc", "use nix"),
  );
  el.querySelectorAll('textarea').forEach(setDefaultHeight);
  return el
}

export function TextField (id, ...content) {
  return DOM([`div.field.file#${id}`,
    ['div.handle-v', { onclick: toggleField },
      ['svg.icon.expanded', ['use[href=icons.svg#icon-chevron-down]']],
      ['div.grow']],
    ['div.flex.col.grow',
      ['div.flex.row', ['div.name', id], ['div.handle-h']],
      [`textarea#text:${id}`, content.filter(Boolean).join('\n')]]]);
}

export function HexField (id, ...content) {
  return DOM([`div.field.file.hex#${id}`,
    ['div.handle-v', { onclick: toggleField },
      ['svg.icon.expanded', ['use[href=icons.svg#icon-chevron-down]']],
      ['div.grow']],
    ['div.flex.col.grow',
      ['div.flex.row', ['div.name', id], ['div.handle-h']],
      HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);
}

export function HexRow (addr, bytes, chars) {
  return ['div.row.hex-row', addr, bytes, chars]
}

function toggleField (e) {
  const target = e.currentTarget;
  target.parentElement.classList.toggle('collapsed');
  if (target.parentElement.classList.contains('collapsed')) {
    target.firstChild.firstChild.href.baseVal = 'icons.svg#icon-chevron-right';
  } else {
    target.firstChild.firstChild.href.baseVal = 'icons.svg#icon-chevron-down';
    const textarea = target.parentElement.querySelector('textarea');
    if (textarea) {
      textarea.focus();
      setDefaultHeight(textarea);
    }
  }
}

function setDefaultHeight (textarea: HTMLTextAreaElement) {
  textarea.style.height ||= `${1.25*(1+Math.max(2, textarea.value.split('\n').length))}em`;
}
