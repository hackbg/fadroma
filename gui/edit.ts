import { DOM, Bytes } from '../lib/index.ts';
import { elById, pinSize, textVal, Icon } from './lib.ts';
import { zipSync, zipStr } from '../lib/deps.ts';

export function initEditors (el = elById("editors"), {
  btc    = true,
  simf   = true,
  nix    = true,
  direnv = true,
} = {}) {
  pinSize(el, () => {
    el.innerHTML = '';
    el.appendChild(DOM(...ProjectInfo()));
    el.appendChild(DOM(...ProjectSimf()));
    el.appendChild(DOM(...ProjectEsm({ btc, simf })));
    el.appendChild(DOM(...ProjectEnv({ btc, simf, nix, direnv })));
  });
  el.querySelectorAll('textarea').forEach(setDefaultHeight);
  return el
}

export async function loadExample () {
}

export async function updateProject (_e) {
}

export async function saveProject () {
  const title   = textVal('title') || 'fadroma';
  const license = textVal('license');
  const archive = {};
  elById("editors").querySelectorAll('[data-path]').forEach((el: HTMLElement)=>{
    archive[el.dataset.path] = zipStr(el.querySelector('textarea')?.value);
  });
  downloadFile(`${+new Date()}-${title}.zip`, 'application/zip', zipSync(archive))
}

function downloadFile (name: string, type: string, ...parts: BlobPart[]) {
  const file = new File(parts, name, { type });
  const url  = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const ProjectInfo = () => [

  ['div.row.gap.fields',
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
        ['option', 'Closed source (inquire)']]]],

  TextField("README", "Created at https://fadroma.tech"),
];

const ProjectSimf = () => [
  WitnessField("src/main.wit", ' '),
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
    (btc||simf)&&`import { ${
      [btc  && 'Btc'
      ,simf && 'Simf'
      ].filter(Boolean).join(', ')
    } } from '../lib/index.ts';`,
    `export async function deploy () {}`),

  TSTestField("test.ts",
    `import { Test, Btc, Simf } from '../lib/index.ts';`,
    `import { deploy } from './index.ts';`,
    `export default Test.suite(import.meta, "Test",`,
    `  Test.the("Deploy", deploy),`,
    `  Test.the("Invoke"));`),
  TextField("package.json",
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
  TextField("tsconfig.json",
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

const Field = Object.assign(function defineField ({
  id,
  collapsed = true,
  header    = [],
  content   = []
}) {
  return [`div.field.file${collapsed?'.collapsed':''}#${id}[data-path=${id}]`,
    ['div.handle-v', { onclick: Field.toggle(id) },
      ['svg.icon', ['use[href=icons.svg#chevron-right]']],
      ['div.grow']],
    ['div.flex.col.grow',
      ['div.flex.row',
        ['div.name', { onclick: Field.toggle(id) }, id],
        ['div.handle-h', { onclick: Field.toggle(id) }], ...header],
      ...content]];
}, {
  toggle: function toggleField (id) {
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
})

const TextField = (id, ...content) => Field({
  id,
  content: [[`textarea.collapsible#text:${id}`, content.filter(Boolean).join('\n')]]
});
const TSField = (id, ...content) => Field({
  id, collapsed: false,
  header:  [['div.command', Icon('play'), 'Check']],
  content: [[`textarea.collapsible#text:${id}`, content.filter(Boolean).join('\n')]]
});
const TSTestField = (id, ...content) => Field({
  id, collapsed: false,
  header:  [['div.command', Icon('play'), 'Test']],
  content: [[`textarea.collapsible#text:${id}`, content.filter(Boolean).join('\n')]],
});
const SimfField = (id, ...content) => Field({
  id, collapsed: false,
  header:  [['div.command', Icon('play'), 'Compile']],
  content: [['div.collapsible',
    //SimfFn('main', ...content),
    //SimfFn('checksig'),
    //SimfFn('checksigfromstack'),
    ['div.row', ['div.grow'], ['div.command', Icon('circle-with-plus'), 'Define']]
  ]]
});
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

const WitnessField = (id, ...content) => Field({
  id, collapsed: false,
  content: [['div.col.collapsible',
    WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
    WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
    WitnessRow('sig', 'ORACLE_SIG',    ''),
    WitnessRow('sig', 'OWNER_SIG',     ''),
    ['div.row', ['div.grow'], ['div.command', Icon('circle-with-plus'), 'Witness']]]]
});

const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
  ['div.witness',
    ['div.row.gap',
      ['label', ['select', ['option', { value: t }, t]]],
      ['input[type=text].grow', { value: k }],
      ['label.row', ['input[type=text].grow', { value: v }]]]];

const HexField = (id, ...content) =>
  DOM([`div.field.file.hex#${id}`,
    ['div.handle-v', { onclick: Field.toggle(id) },
      ['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
      ['div.grow']],
    ['div.flex.col.grow',
      ['div.flex.row',
        ['div.name', { onclick: Field.toggle(id) }, id],
        ['div.handle-h', { onclick: Field.toggle(id) }]],
      HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
      HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

const HexRow = (addr, bytes, chars) =>
  ['div.row.hex-row', addr, bytes, chars];


function setDefaultHeight (textarea: HTMLTextAreaElement) {
  textarea.style.height ||= `${1.5*(1+Math.max(2, textarea.value.split('\n').length))}em`;
}
