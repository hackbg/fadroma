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
  export class YAMLDirectory extends Directory {}
  export class TOMLDirectory extends Directory {}

  export const withTmpDir:  ContextWrapper

  export class File {
    make: Function
    path: string
    exists (): boolean
    load (): any
    save (_1: any): any
  }

  export class BinaryFile extends File {}
  export class TextFile   extends File {}
  export class JSONFile   extends TextFile {}
  export class YAMLFile   extends TextFile {}
  export class TOMLFile   extends TextFile {}

  export const withTmpFile: ContextWrapper

  type ContextWrapper = (ContextWrapped)=>void
  type ContextWrapped = <T>(path: string)=>T

}
