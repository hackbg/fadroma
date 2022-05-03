declare module '@hackbg/runspec' {
  export type Suites = Record<string, object> // TODO clarify naming and typing
  type RunSpec = (suites: Suites, selected: string[]) => Promise<void>
  export default RunSpec
  export const runSpec: RunSpec
}
