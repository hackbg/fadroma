import type { Fn } from './index.ts';
import { getCwd, resolvePath, realpathSync, stdout, watchFs } from './deps.ts';
import { call } from './call.ts';
import { ANSI } from './format.ts';
export async function watch (
  callback: Fn<[string, string[]]>,
  _argv: unknown
) {
  const cwd = getCwd();
  let timer = null;
  const interval = 100;
  await update({ force: true });
  for await (const event of watchFs(".")) {
    await update(event);
  }
  async function update ({ force = false, kind = null, paths = [] } = {}) {
    if (!force) {
      if (kind === 'access') return;
      //paths = paths.map(x=>(typeof x === 'string')?x.replace(cwd, '.'):x);
      paths = paths
        .filter(x=>!x.endsWith('~'))
        .filter(x=>!x.includes('/.git/'))
        .filter(x=>!x.includes('/toolbox/'))
        .filter(x=>!x.includes('/.deno.lock'));
      if (paths.length === 0) return;
      paths = paths
        .map(x=>{ try { return realpathSync(x) } catch (e) { if (e.code!=='ENOENT') throw e } })
        .filter(Boolean)
        .map(x=>resolvePath(x).replace(cwd, '.'))
        .filter(x=>!x.includes('/node_modules/.deno/'));
      if (paths.length === 0) return;
      stdout.write(''
        + `\x1b[${stdout.rows||1};1H`
        + `\x1b[0K`
        + ANSI.blue(''
            + ANSI.bold(kind)
            + ' '
            + paths.join(', ').slice(0, stdout.columns-10)));
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(call(callback, kind, paths), force ? 0 : interval);
  }
}

