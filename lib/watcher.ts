import { Fn, msec } from './format.ts';
import { bold, blue } from './format/Ansi.ts';
import { cwd, resolvePath, realpathSync, stdout, watchFs } from './deps.ts';
export * from './watcher/denoCheck.ts';
export * from './watcher/runTest.ts';
/** Entrypoint that reruns on file change. */
export const entrypoint = function watchEntrypoint (
  meta: Fn.Main.Meta, mode: Fn<[string, string[]]>, ...options: unknown[]
) {
  return Fn.Main(meta, Fn(watch, mode, options||[]))
};
const toRealPath = (x: string) => {
  try { return realpathSync(x) } catch (e) { if (e.code!=='ENOENT') throw e }
};
const toRelativePath = (cwd: string) => (x: string) => {
  return resolvePath(x).replace(cwd, '.');
};
/** Run a watcher function. */
export async function watch (mode: Fn<[string, string[]]>, options: unknown[]) {
  // todo: make configurable
  // debounce timer
  let timer = null;
  // debounce interval
  const interval = 100;
  // initial run
  await update({ force: true });
  // update on every event
  for await (const event of watchFs(".")) await update(event);
  // main update function
  async function update ({
    force = false, kind = null, paths = [],
    filter = (x: string = '') => !(
      (!x)||
      (x.length===0)||
      x.endsWith('~')||
      x.includes('/.git/')||
      x.includes('/toolbox/')||
      x.includes('/coverage/')||
      x.includes('/.deno.lock')||
      x.includes('/.direnv/')||
      x.includes('/node_modules/.deno')
    ),
  } = {}) {
    
    // non-forced updates go through the debounce
    if (!force) {
      // ignore access events; todo: configurable
      if (kind === 'access') return;
      // ignore paths we don't care about
      paths = paths.map(toRealPath).filter(filter).map(x=>x.trim());
      // skip if only ignored paths were updated
      if (paths.length === 0) return;
      // convert paths to relative and filter again
      paths = paths.filter(Boolean).map(toRelativePath(cwd()));
      // log update at bottom left corner
      stdout.write(blue(bold(kind) + ' ' + paths.join(', ').slice(0, stdout.columns)));
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const t0 = performance.now();
      try {
        await mode(kind, paths, ...options)
      } finally {
        stdout.write(
          `\x1b[${stdout.rows||1};${1}H` +
          blue('Waiting for changes in ' + bold(cwd())) +
          `\x1b[${stdout.rows||1};1H` +
          `\x1b[${Math.max(0, stdout.columns - 10)}G` +
          blue(msec(performance.now() - t0)));
      }
    }, force ? 0 : interval);
  }
}
