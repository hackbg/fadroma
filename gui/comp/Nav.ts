import { on, elById } from '../lib.ts';
import { Editor } from './Editor.ts';
import { loadDocs } from './Docs.ts';

export const Nav = async function initNavigation () {
  on(elById("buttonbar"), "click", navigate);
}

export async function navigate (e: Event) {
  let target = e.target as HTMLElement;
  do {
    if (target.dataset.action) switch (target.dataset.action) {
      case 'new':  e.preventDefault(); return Editor();
      case 'load': e.preventDefault(); return Editor.load();
      case 'save': e.preventDefault(); return Editor.save();
      case 'docs': e.preventDefault(); return loadDocs("/docs/deno/index.html");
      default: return;
    }
    target = target.parentElement;
  } while (target && target !== e.currentTarget);
}
