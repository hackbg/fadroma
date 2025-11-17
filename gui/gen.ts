import { Dir, Zip, Txt, Bin } from '../lib/index.ts';
import { elById, textVal, byteVal } from './lib.ts';

export async function updateProject (e) {
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
  const file = new File([zip as BlobPart], filename, { type: 'application/zip' });
  const url = URL.createObjectURL(file);
  console.log(url);
  const downloadLink = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
