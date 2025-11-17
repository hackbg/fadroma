import type { Bytes } from '../lib/index.ts';
import { Dir, Zip, Txt, Bin, DOM } from '../lib/index.ts';

const elById  = (id: string) => document.getElementById(id);
const checked = (id: string) => !!(elById(id) as HTMLInputElement)?.checked;
const textVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim();
const byteVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME
const on = (x: EventTarget, ev, cb) => { x?.addEventListener(ev, cb); return cb; }

export async function updateProject (e) {
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

export async function saveProject () {
  const title    = textVal('title');
  const license  = textVal('license');
  const filename = `${+new Date()}-${title}.zip`
  const project  = Zip(filename,
    Dir(Txt('README.md', textVal('readme')),
      Dir('src',
        Txt('main.simf', textVal('src/main.simf')),
        Bin('main.wit',  byteVal('src/main.wit')))));
  const zip = await project();
  console.log(zip.tree)
  const file = new File([zip], filename, { type: 'application/zip' });
  const url = URL.createObjectURL(file);
  console.log(url);
  const downloadLink = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

export const FileField = name => DOM(
  ['div.field.file',
    ['label.name',
      ['input[type=checkbox][name=show:README].collapse'],
      ['svg.icon.expanded',  ['use[xlink:href=#icon-chevron-down]']],
      ['svg.icon.collapsed', ['use[xlink:href=#icon-chevron-right]']],
      name],
    ['div.flex.col',
      ['textarea#text:README[placeholder=place holder]']]]);
