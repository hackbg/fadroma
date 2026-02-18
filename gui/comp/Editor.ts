import Html from '../../library/Html.ts';
import { zipSync, strToU8 as zipStr } from 'fflate';
import * as Monaco from 'monaco-editor';
import { elById, textVal, download } from '../lib.ts';
import Field from './Field.ts';
import Simf  from './Simf.ts';
import ES    from './ES.ts';
import Nix   from './Nix.ts';

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
  Html.append(el, Html(['div.box.editors', ['div', ['div.grow',
    Programs(),
    Testing({ deno, node, btc }),
    DevEx({ nix, btc, simf, element, direnv }),
    Metadata()
  ]]]));
  setTimeout(()=>initEditor(el), 1);
  return el
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

function Programs () {
  return ['section.layer',
    ['p.36ch', ['strong', 'SimplicityHL programs'], ' can be imported from TS or run from the command line:'],
    ['div.col.grow', Simf.P2PKTS(), Simf.P2PKHTS(), Simf.HodlVaultTS(), Simf.EscrowTS()]]
}

function Testing ({ deno, node, btc }) {
  return ['section.layer',
    ['p', ['strong', 'Fast integration testing on real localnet'], ' is included out of the box:'],
    ['div.col.grow', ES.TestSuite({ deno, node, btc })]]
}

function DevEx ({ nix, btc, simf, element, direnv }) {
  return ['section.layer',
    ['p', ['strong', 'Local dev dependencies'], ' provided by Nix and Direnv, or bring your own:'],
    //ES.DenoJsonField(deno),
    //PackageJsonField({ node, vite }),
    //TsConfigField(),
    direnv && Field.Text(".envrc", "use nix"),
    Nix({ nix, btc, simf, element })]
}

function Metadata () {
  return ['section.layer',
  ['p', 'Edit this example project, then download it to continue locally:'],
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
        ['div.field.head.grow', ['div.name', 'Clear']]],
      Field.Text("README", "Created at https://fadroma.tech")]]
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
