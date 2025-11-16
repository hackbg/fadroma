import type { Bytes } from '../lib/index.ts';
import { Dir, Zip, Txt, Bin } from '../lib/index.ts';

const elById  = (id: string) => document.getElementById(id);
const checked = (id: string) => !!(elById(id) as HTMLInputElement)?.checked;
const textVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim();
const byteVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME
const on = (x: EventTarget, ev, cb) => { x?.addEventListener(ev, cb); return cb; }

on(elById("sidebar"),  "change", toolbarOnChange);
on(elById("navbar"),   "click",  navbarOnClick);
on(elById("download"), "click",  generateProject);
async function toolbarOnChange (e) {
  const { id, checked, value: _ } = e.target;
  if (id === 'enable.simf') {
    if (!checked) {
      elById("src/main.simf").dataset["disabled"] = "disabled";
      elById("src/main.wit").dataset["disabled"] = "disabled";
    } else {
      delete elById("src/main.simf").dataset["disabled"];
      delete elById("src/main.wit").dataset["disabled"];
    }
  }
}
async function navbarOnClick (e) {
  if (e.target.href) {
    e.preventDefault();
    elById("main").innerHTML = 'loading...';
    fetch(e.target.href)
      .then(response=>response.text())
      .then(html=>{
        const frag = new DocumentFragment();
        const docs = new DOMParser().parseFromString(html, 'text/html');
        docs.querySelectorAll(".namespaceSection").forEach(section=>{
          section.querySelectorAll("span.italic").forEach(span=>{
            if ((span as HTMLElement).innerText === "No documentation available") {
              (span as HTMLElement).innerHTML = '&nbsp;';
            }
          });
          section.querySelectorAll(".docNodeKindIcon > div[title]").forEach(icon=>{
            const kind = (icon as HTMLDivElement).title;
            const item = icon.parentElement.parentElement;
            const link = item.querySelector('a');
            item.dataset.kind ??= "";
            item.dataset.kind += kind;
            if (kind === 'Namespace') {
              const checkbox = Object.assign(document.createElement('input'), {
                type: 'checkbox',
                id: `ns-${link.title}`
              });
              link.prepend(checkbox);
            }
            if (link.title.includes('.')) {
              const [ns, _] = link.title.split('.');
              item.dataset.ns = ns;
            }
          });
          frag.appendChild(section);
        });
        elById("main").innerHTML = '';
        elById("main").appendChild(frag);
      });
  }
}
async function generateProject () {
  const title    = elById('title').value.trim()||'untitled';
  const license  = elById('license').value;
  const filename = `${+new Date()}-${title}.zip`
  const project  = Zip(filename,
    Dir(Txt('README.md', textVal('readme')),
      Dir('src',
        Txt('main.simf', textVal('src/main.simf')),
        Bin('main.wit',  byteVal('src/main.wit')))));
  const zip = await project();
  const file = new File([zip], filename, { type: 'application/zip' });
  const url = URL.createObjectURL(file);
  console.log(url);
  const downloadLink = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
