import { on, elById } from './lib.ts';
import { loadDocs } from './Docs.ts';
import Editor from './Editor.ts';
import scrollTo from 'animated-scroll-to';

export async function Nav () {
  on(elById("navbar"), "click", navigate);
  on(document.body, "click", ({ target }) => {
    while (target !== document.body) {
      console.log(...target.classList)
      if (target.classList.contains('scroll-to')) {
        const y = target.offsetTop - 100;
        if (window.scrollY < y) scrollTo(Math.max(0, y));
        console.log(target.offsetHeight, target.offsetTop, window.innerHeight, window.scrollY);
        break;
      }
      target = target.parentElement
    }
  })
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
