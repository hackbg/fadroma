export type Spawn   = (_: Context) => { pid: number };
export type Option  = <T extends Context>(context: T) => T;
export type Context = { argv: string[] };
