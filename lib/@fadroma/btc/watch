#!/usr/bin/env -S deno run --allow-read --allow-run
import { setTimeout, clearTimeout } from 'node:timers';
const watcher = Deno.watchFs(".");
let timer = null;
const interval = 100;
const decoder = new TextDecoder();
await update();
for await (const event of watcher) update(event);
async function update (event = {}) {
  if (timer) clearTimeout(timer);
  console.clear();
  console.log(event.kind, ...event.paths||[]);
  timer = setTimeout(async ()=>{
    const ran = Deno.run({ cmd: ["./test.ts"], stdout: 'piped', stderr: 'piped', })
    console.log(decoder.decode(await ran.output()))
  }, interval);
}
