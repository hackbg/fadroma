import type { Step, ChildProcess } from './deps.ts';

export type Service  = Step<Ports & Pids>;

export type Listen   = Step<Ports>;
export type Ports    = { ports: Record<number, unknown> };

export type Spawn    = Step<Pids>;
export type Pids     = { pids: Record<number, unknown>
                       , exec  (_: Command): Shellout
                       , spawn (_: Command): ChildProcess
                       , kill  (pid: number): Promise<unknown> };
export type Shellout = { pid:    number
                       , output: unknown[]
                       , stdout: string|unknown
                       , stderr: string|unknown
                       , status: number|null
                       , signal: string|null
                       , error?: Error };

export type Option   = Step<Command>;
export type Command  = { argv:     string[]
                       , options?: { env?: Record<string, unknown> } };
