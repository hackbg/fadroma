declare module '@hackbg/konzola' {

  export { prompts } from 'prompts'

  export * as colors from 'colors'
  export const bold: (string)=>string

  export { render } from 'prettyjson'

  export { table } from 'table'

  type MakeConsole = (string) => {
    constructor (string)
    log   (...args: any)
    info  (...args: any)
    warn  (...args: any)
    error (...args: any)
    debug (...args: any)
    trace (...args: any)
  }
  export const Console: MakeConsole
  export const Konzola: MakeConsole
  export default MakeConsole

}
