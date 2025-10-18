import type { Info, MaybeAsync } from '@hackbg/fadroma';
/** Valid test result categories. */
export type Category = 'pass'|'fail'|'todo'|'warn';
/** Things keyed by category name. */
export type Categorized<T> = Record<Category, T>;
/** Start time and duration. */
export type Timed = { t0?: number, tD?: number };
/** The test report. */
export type Report = Categorized<Results> & Info & CanGetContext;
/** Can obtain updated context. */
export type CanGetContext = { getContext (_?: Partial<Context>): Context };
/** The test context for a step. */
export type Context = Categorized<Add> & Timed & CanGetContext & {
  /** Breadcrumb of parent step indexes. */
  ids: number[],
  /** Breadcrumb of parent step names. */
  names: string[],
  /** Execute a test step and categorize the result. */
  track: Track
};
/** Function that tracks a leaf of the test tree. */
export type Track = <T>(id: number|null, name: string|null, callback: Step<T>) => MaybeAsync<T>;
/** A test step. */
export type Step<T> = { stack?: string[] } & ((context: Context) => MaybeAsync<T>);
/** The result of a test step. */
export type Result = Timed & { summary: string|null, details: unknown[] };
/** Collection of results for a given category. */
export type Results = Result[] & Info & { icon: string, add: Add };
/** Add a result to a category. */
export type Add = (t0: number, summary: string|null, ...extra: unknown[])=>void;
