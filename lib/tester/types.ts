import type { Info, Timed, MaybeAsync, MaybeAsyncFn } from './deps.ts';

/** A test step. */
export type Step<T> = { stack?: string[]
                      , steps?: unknown[]
                      } & MaybeAsyncFn<T, [Context]>;

/** Collection of results for a given category. */
export type Results = { icon: string
                      , add:  Add
                      } & Result[] & Info;

/** The result of a test step. */
export type Result  = { summary: string|null
                      , details: unknown[]
                      } & Timed;

/** Category noun. */
export type Category = 'passed'|'failed'|'tasks'|'warnings'|'skipped';

/** Tracks each step, sorting outcomes into categories. */
export type Report = Record<Category, Results> & Contextual & Info;

/** Can obtain updated context. */
export type Contextual = { context (_?: Partial<Context>): Context };

/** Category verb. */
export type Categorize = 'pass'|'fail'|'todo'|'warn'|'skip';

/** The test context for a step. */
export type Context    = { /** Whether the whole test run should terminate
                             * on the first failing step. */
                           failFast?:   boolean
                         , /** Whether TODOs count toward test failures. */  
                           failOnTodo?: boolean
                         , /** Breadcrumb of parent step indexes. */
                           ids:         number[]
                         , /** Breadcrumb of parent step names. */
                           names:       string[]
                         , /** Execute and categorize a test step. */
                           track:       Track
                         } & Record<Categorize, Add> & Contextual & Timed;

/** Track the status of a leaf of the test tree. */
export type Track = <T>(id: number|null, name: string|null, callback: Step<T>)
  => MaybeAsync<T>;

/** Add result to category. */
export type Add = (t0: number, summary: string|null, ...extra: unknown[])
  => unknown;
