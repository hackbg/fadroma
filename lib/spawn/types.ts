export type Spawn   = (_: Context) => { pid: number, ports?: number[] };
export type Option  = <T extends Context>(context: T) => T;
export type Context = { pids: Record<number, unknown>, ports: Record<number, unknown> };
