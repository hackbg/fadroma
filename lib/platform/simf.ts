import type { Bytes, Meta } from '../index.ts';
import { fileURLToPath, resolvePath } from '../deps.ts';
import { Dir, Txt, Bin, Exec, Markdown } from '../context.ts';
import { Fn, Error, Name, Base16, Base64, Pipe, chunked, merged } from '../format.ts';
import { Btc } from './btc.ts';

export function Simf (meta: Meta, path: string) {
  path = resolvePath(fileURLToPath(meta.url), '..', path);
  return {
    path,
    build:    Exec('simply', '--entrypoint', path, 'build'),
    deposit:  Exec('simply', '--entrypoint', path, 'deposit'),
    withdraw: Exec('simply', '--entrypoint', path, 'withdraw'),
  }
}
