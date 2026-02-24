import * as Monaco from 'monaco-editor';
import { zipSync, strToU8 as zipStr } from 'fflate';

import Field from './Field.ts';
import Simf  from './Simf.ts';
import Html  from '../library/Html.ts';
import { elById, textVal, download } from './lib.ts';

export default Editor;

function Editor ({
  editorView = elById("editors"), 
  usersView  = elById("demousers"),

  btc      = true,
  elements = true,
  simf     = true,
  nix      = true,
  direnv   = true,
  node     = true,
  deno     = true,
  //vite =    false,
} = {}) {
  editorView.innerHTML = '';
  Html.append(editorView, Html(['div.box.editors.col.grow.gap.justify-between',
    Simf({ nix, btc, simf, elements, direnv, deno, node }).view]));
  setTimeout(()=>initEditor(editorView), 1);
  Simf.Users({ view: usersView });
  return {
    editorView,
    usersView
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
