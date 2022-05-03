declare module '@hackbg/runspec' {
 // TODO clarify naming and typing
  export interface Suites extends Record<string, object> {}
  export type RunSpec = (suites: Suites, selected: string[]) => Promise<void>
  export default RunSpec
  export const runSpec: RunSpec
}
