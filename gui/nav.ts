import { on, elById } from './lib.ts';
import { initEditors, saveProject, loadExample } from './edit.ts';
import { loadDocs } from './doc.ts';

export async function initNavigation () {
  on(elById("buttonbar"), "click", navigate);
}

export async function navigate (e: Event) {
  let target = e.target as HTMLElement;
  do {
    if (target.dataset.action) switch (target.dataset.action) {
      case 'new':  e.preventDefault(); return initEditors();
      case 'load': e.preventDefault(); return loadExample();
      case 'save': e.preventDefault(); return saveProject();
      case 'docs': e.preventDefault(); return loadDocs("/docs/deno/index.html");
      default: return;
    }
    target = target.parentElement;
  } while (target && target !== e.currentTarget);
}
