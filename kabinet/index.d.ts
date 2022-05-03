declare module '@hackbg/kabinet' {

  export type Path = string

  import mkdirp from 'mkdirp'
  export { mkdirp }

  import symlinkDir from 'symlink-dir'
  export { symlinkDir }

  import tmp from 'tmp'
  export { tmp }

  import copy from 'recursive-copy'
  export { copy }

  export * from 'fs'
  export * from 'fs/promises'
  export { homedir } from 'os'
  export { resolve, relative, dirname, basename, extname } from 'path'
  export { fileURLToPath } from 'url'
  export { cwd } from 'process'

  export const mkdir:  (...fragments: Path[]) => Path
  export const rimraf: (path: Path)=>Promise<Path>

  export class Directory {
    constructor (_: string)
    path:    string
    make:    Function
    subdir:  Function
    resolve: Function
    load:    Function
    save   (_1: any, _2: any)
    exists (): boolean
    delete ()
  }

  export class JSONDirectory extends Directory {}

  export class File {
    make: Function
    path: string
    exists (): boolean
    load (): any
    save (_1: any): any
  }

  export class JSONFile extends File {
    constructor (_1: string, _2: string)
  }

  export const withTmpDir:  ContextWrapper
  export const withTmpFile: ContextWrapper
  type ContextWrapper = (ContextWrapped)=>void
  type ContextWrapped = <T>(path: string)=>T

}
