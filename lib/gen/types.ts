export type CargoDep = {};
export type CargoFeature = {};
/** Context for executing filesystem operations: current working directory. */
export type FSContext = string;
/** A filesystem operation. Needs current working directory. */
export type FSOp = (_: FSContext) => FSContext;

export type Readme = { title?: string, sections?: [string, string] };
