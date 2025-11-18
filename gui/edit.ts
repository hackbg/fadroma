import { Fn, DOM, Bytes, Dir, Zip, Txt, Bin } from '../lib/index.ts';
import { elById, append, pinSize, textVal, byteVal, Icon } from './lib.ts';

export async function clearProject () {
}

export function initEditors (el = elById("editors")) {
  pinSize(el, (_w, _h) => {
    el.innerHTML = '';
    append(el, ...ProjectInfo());
    append(el, ...ProjectSimf());
    append(el, ...ProjectEsm({ btc: true, simf: true }));
    append(el, ...ProjectEnv({ btc: true, simf: true, nix: true, direnv: true }));
  });
  el.querySelectorAll('textarea').forEach(setDefaultHeight);
  return el
}

export async function loadExample () {
}

export async function updateProject (e) {
}

export async function saveProject () {
  console.log(elById("editors").querySelectorAll('[path]'));
  //const title    = textVal('title');
  //const license  = textVal('license');
  //const filename = `${+new Date()}-${title}.zip`
  //const project  = Zip(filename,
    //Dir(Txt('README.md', textVal('readme')),
      //Dir('src',
        //Txt('main.simf', textVal('src/main.simf')),
        //Bin('main.wit',  byteVal('src/main.wit')))));
  //const zip = await project();
  //console.log(zip.tree)
  //const file = new File([zip as BlobPart], filename, { type: 'application/zip' });
  //const url = URL.createObjectURL(file);
  //console.log(url);
  //const downloadLink = Object.assign(document.createElement('a'), { href: url, download: filename });
  //document.body.appendChild(downloadLink);
  //downloadLink.click();
  //document.body.removeChild(downloadLink);
}

const ProjectInfo = () => [
  DOM([
    'div.row.gap.fields',
    ['div.field.grow',
      ['div.name', 'Title'],
      ['input#title[type=text][focused=focused]', { placeholder: 'name your project' }]],
    ['div.field',
      ['div.name', 'Licence'],
      ['select#licence',
        ['option', 'AGPL 3.0 or later'],
        ['option', 'AGPL 3.0 only'],
        ['option', 'GPL 3.0 or later'],
        ['option', 'GPL 3.0 only'],
        ['option', 'Closed source (inquire)']]]]),
  TextField("README",
    "Created at https://fadroma.tech"),
];

const ProjectSimf = () => [
  WitnessField("src/main.wit",
    ' '),
  SimfField("src/main.simf",
    '  let oracle_height: u32 = witness::ORACLE_HEIGHT;',
    '  let oracle_price:  u32 = witness::ORACLE_PRICE;',
    '  let oracle_sig: Signature = witness::ORACLE_SIG;',
    '  let owner_sig:  Signature = witness::OWNER_SIG;'),
];

const ProjectEsm = ({
  btc = false, simf = false
} = {}) => [
  TSField("index.ts",
    `import { Btc, Simf } from '../lib/index.ts';`,
    `export async function deploy () {}`),
  TSTestField("test.ts",
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
];

const ProjectEnv = ({
  btc = false, simf = false, nix = false, direnv = false
} = {}) => [
  TextField("shell.nix",
    `{pkgs ? import<nixpkgs> {} }: pkgs.mkShell {`,
    `  nativeBuildInputs = [`,
    `    pkgs.bitcoind`,
    `  ];`,
    `}`),
  TextField(".envrc", "use nix"),
];

const Field = (id, header, ...content) =>
  [`div.field.file.collapsed#${id}[data-path=${id}]`,
    ['div.handle-v', { onclick: toggleField(id) },
      ['svg.icon', ['use[href=icons.svg#chevron-right]']],
      ['div.grow']],
    ['div.flex.col.grow',
      ['div.flex.row',
        ['div.name', { onclick: toggleField(id) }, id],
        ['div.handle-h', { onclick: toggleField(id) }], ...header],
      ...content]];

const TextField = (id, ...content) =>
  DOM(Field(id, [], [`textarea.collapsible#text:${id}`, content.filter(Boolean).join('\n')]));

const TSField = (id, ...content) =>
  DOM(Field(id, [
    ['div.command', Icon('play'), 'Check'],
  ], [`textarea.collapsible#text:${id}`, content.filter(Boolean).join('\n')]));

const TSTestField = (id, ...content) =>
  DOM(Field(id, [
    ['div.command', Icon('play'), 'Test'],
  ], [`textarea.collapsible#text:${id}`, content.filter(Boolean).join('\n')]));

const SimfField = (id, ...content) =>
  DOM(Field(id, [
    ['div.command', Icon('play'), 'Compile'],
  ], ['div.collapsible',
    SimfFn('main', ...content),
    SimfFn('checksig'),
    SimfFn('checksigfromstack'),
    ['div.row', ['div.grow'], ['div.command', Icon('circle-with-plus'), 'Add declaration']]
  ]));

const SimfFn = (name, ...content) =>
  ['div.col.fn',
    ['div.row.align-center',
      ['strong.keyword', 'fn '],
      [`input[type=text][size=${name.length-2}]`, { value: name }],
      '(',
      [`input[type=text][size=2]`],
      ')',
      ' { ',
      ['div.grow'],
      ['div.command', Icon('circle-with-cross'), 'Remove']],
    ['textarea', content.join('\n')||' '],
    '}'];

const WitnessField = (id, ...content) =>
  DOM(Field(id, [
  ], ['div.col.collapsible',
    WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
    WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
    WitnessRow('sig', 'ORACLE_SIG',    ''),
    WitnessRow('sig', 'OWNER_SIG',     ''),
    ['div.row', ['div.grow'], ['div.command', Icon('circle-with-plus'), 'Add witness']]
  ]));

const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
  ['div.witness',
    ['div.row.gap',
      ['label', ['select', ['option', { value: t }, t]]],
      ['input[type=text].grow', { value: k }],
      ['label.row', ['input[type=text].grow', { value: v }]]]];

const HexField = (id, ...content) =>
  DOM([`div.field.file.hex#${id}`,
    ['div.handle-v', { onclick: toggleField(id) },
      ['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
      ['div.grow']],
    ['div.flex.col.grow',
      ['div.flex.row',
        ['div.name', { onclick: toggleField(id) }, id],
        ['div.handle-h', { onclick: toggleField(id) }]],
      HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

const HexRow = (addr, bytes, chars) =>
  ['div.row.hex-row', addr, bytes, chars];

function toggleField (id) {
  return () => {
    const el = elById(id);
    console.log({id, el});
    const icon = el.querySelector('.icon') as SVGUseElement;
    el.classList.toggle('collapsed');
    if (el.classList.contains('collapsed')) {
      icon.firstChild.href.baseVal = 'icons.svg#chevron-right';
    } else {
      icon.firstChild.href.baseVal = 'icons.svg#chevron-down';
      const textarea = el.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        setDefaultHeight(textarea);
      }
    }
  }
}

function setDefaultHeight (textarea: HTMLTextAreaElement) {
  textarea.style.height ||= `${1.5*(1+Math.max(2, textarea.value.split('\n').length))}em`;
}
