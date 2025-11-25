import { Meta, Main } from '../index.ts';
import { fileURLToPath, resolvePath, argv, stdout, stderr } from '../deps.ts';
import { Exec } from '../context.ts';
/** Simplicity program. */
export interface Simf {
  path:     string
  build:    Exec
  deposit:  Exec
  withdraw: Exec
}
/** Simplicity program constructor. */
export const Simf: {
  /** Define Simplicity program. */
  (path: string): Simf;
  /** Define Simplicity program's SDK entrypoint. */
  (meta: Meta, path: string): Simf;
} = function Simf (...args: unknown[]): Simf {
  if (typeof args[0] === 'string') args.unshift(null);
  let [meta, path] = args as [Meta, ...string[]];
  path = resolvePath(meta?.url ? fileURLToPath(meta?.url) : '', '..', path);
  const simf: Simf = { path,
    build:    Exec('simply', 'build',    '--entrypoint',  path),
    deposit:  Exec('simply', 'deposit',  '--entrypoint',  path),
    withdraw: Exec('simply', 'withdraw', '--entrypoint',  path,
                                         '--txid',        'TODO',
                                         '--destination', 'TODO') };
  if (meta?.main) simfCli(simf);
  return simf as Simf;
}
/** Simplicity CLI wrapper. */
async function simfCli (simf: Simf) {
  const [_, __, command, ...args] = argv;
  switch (command.trim()) {
    case undefined:  stderr.write(' build  deposit  withdraw');         break;
    case 'build':    Promise.resolve(simf.build()).then(showOutput);    break;
    case 'deposit':  Promise.resolve(simf.deposit()).then(showOutput);  break;
    case 'withdraw': Promise.resolve(simf.withdraw()).then(showOutput); break;
    default: throw new Error(`invalid command: ${command}`) }
  function showOutput (output: unknown) {
    const o = output as { stdout: string, stderr: string };
    stderr.write(o.stderr);
    stdout.write(o.stdout);
    return output;
  }
}
