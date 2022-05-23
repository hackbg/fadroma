declare module '@hackbg/konzola' {

  export { prompts } from 'prompts'

  export * as colors from 'colors'
  export const bold: (text: string)=>string

  export { render } from 'prettyjson'

  export { table } from 'table'

  export type MakeConsole = (prefix: string) => Console

  export interface Console {
    new (prefix: string): this
    log   (...args: any): void
    info  (...args: any): void
    warn  (...args: any): void
    error (...args: any): void
    debug (...args: any): void
    trace (...args: any): void
  }

  export const Console: MakeConsole
  export const Konzola: MakeConsole
  export default MakeConsole

}
