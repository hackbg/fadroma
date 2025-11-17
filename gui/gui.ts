document.querySelectorAll('script').forEach(x=>x.parentElement.removeChild(x));

import { on, elById } from './lib.ts';
import { navigate } from './nav.ts';
on(elById("navbar"),  "click",  navigate);

import { initFeatures } from './feat.ts';
initFeatures();

import { initEditors } from './edit.ts';
initEditors();

import { updateProject, saveProject } from './gen.ts';
on(elById("sidebar"),  "change", updateProject);
on(elById("download"), "click",  saveProject);
