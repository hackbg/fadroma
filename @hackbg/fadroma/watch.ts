import type { Fn, Meta } from './index.ts';
import type { ChildProcess } from './deps.ts';
import { entrypoint as entry } from './context/command.ts';
import { call, wordWrap, msec } from './format.ts';
import { orange, bold, gray, blue } from './format/ansi.ts';
import { getCwd, resolvePath, realpathSync, stdout, stderr, watchFs,
  execFile, stripVTControlCharacters, execImpl, env } from './deps.ts';

const RE = /(TS\d+)(.+)\n[\s\S]+? at (file:\/\/\/.+\n)/gm;

const decoder = new TextDecoder();

/** Entrypoint that reruns on file change. */
export const entrypoint = function watchEntrypoint (
  meta: Meta,
  main: Fn<[string, string[]]>
) {
  return entry(meta, call(watch, main))
};

/** Run a typecheck on file update. */
export const typecheck = async function watchTypecheck (
  kind: string, paths: string[]
) {
  const t0 = performance.now();
  try {
    const ran = await execImpl('deno', ["check", "index.ts"]);
    console.clear();
    console.log(kind, ...paths);
    console.log({ran});
    const out = await (ran as any).output();
    console.log(decoder.decode(out));
  } catch (e) {
    console.clear();
    e.message = stripVTControlCharacters(e.message)
    const files = {};
    for (const [_, code, error, at] of e.message.matchAll(RE)) {
      const [_, file, line, column] = at.split(':');
      files[file] ??= [];
      files[file].push({ code, error, line, column });
    }
    let checks = 0;
    for (const file of Object.keys(files).sort()) {
      if (files[file].length > 0) {
        console.log(orange(bold(file)), `(${files[file].length})`);
        for (const { code, error, line, column } of files[file]) {
          const line0 = error.trim().split('\n')[0];
          const msg = wordWrap('                '+line0, {
            width: stdout.columns-10,
            indent: '         '
          }).trim();
          console.log(`${bold(String(line).padStart(4, '0'))}:${column.trim().padStart(3, '0')} ${orange(code.trim())} ${gray(4, msg.trim().replace('[ERROR]: ', ''))}`);
          checks++;
        }
        console.log()
      }
    }
    console.log(` ${checks} check(s) to go`);
  } finally {
    stdout.write(
      "\x1b[?25l" +
      `\x1b[${stdout.rows||1};${Math.max(0, stdout.columns - 10)}H` +
      blue(msec(performance.now() - t0)));
  }
}

/** Run a test suite on file update. */
export const test = async function watchTest (_kind: string, _paths: string[]) {
  const t0 = performance.now();
  try {
    const run: ChildProcess = await new Promise((resolve, reject)=>{
      const run = execFile('./test.ts');
      run.once('error', reject)
      run.stdout.pipe(stdout);
      run.stderr.pipe(stderr);
      run.once('spawn', () => { resolve(run); run.off('error', reject); });
    })
    await new Promise((resolve, reject)=>{
      run.once('error', reject);
      run.once('close', () => { resolve(null); run.off('error', reject); });
    })
  } catch (e) {
    console.error(e);
  } finally {
    stdout.write(
      `\x1b[${stdout.rows||1};1H` +
      `\x1b[${Math.max(0, stdout.columns - 10)}G` +
      blue(msec(performance.now() - t0)));
  }
};

const toRealPath = x => { try { return realpathSync(x) } catch (e) { if (e.code!=='ENOENT') throw e } };
const toRelativePath = cwd => x => resolvePath(x).replace(cwd, '.');
export async function watch (callback: Fn<[string, string[]]>, _argv: unknown) {
  // todo: make configurable
  const cwd = getCwd();
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
    filter = x => !(
      x.endsWith('~')||x.includes('/.git/')||x.includes('/toolbox/')||
      x.includes('/.deno.lock')||x.includes('/node_modules/.deno/')
    ),
  } = {}) {
    // non-forced updates go through the debounce
    if (!force) {
      // ignore access events; todo: configurable
      if (kind === 'access') return;
      // ignore paths we don't care about
      paths = paths.filter(filter);
      // skip if only ignored paths were updated
      if (paths.length === 0) return;
      // convert paths to relative and filter again
      paths = paths.map(toRealPath).filter(Boolean).map(toRelativePath(cwd));
      // log update at bottom left corner
      stdout.write(`\x1b[${stdout.rows||1};1H` + `\x1b[0K`
        + blue(bold(kind) + ' ' + paths.join(', ').slice(0, stdout.columns)));
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(call(callback, kind, paths), force ? 0 : interval);
  }
}
