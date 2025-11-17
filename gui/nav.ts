import { elById } from './lib.ts';
import { loadDocs } from './doc.ts';
export async function navigate (e) {
  if (e.target.href) {
    e.preventDefault();
    elById("main").innerHTML = 'loading...';
    fetch(e.target.href)
      .then(response=>response.text())
      .then(loadDocs);
  }
}
