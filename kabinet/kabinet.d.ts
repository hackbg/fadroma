declare module '@hackbg/kabinet' {

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

  export const mkdir:  (...fragments: string[]) => Path
  export const rimraf: (path: string)=>Promise<string>

  export class Path {
    constructor (...fragments: string[])

    path: string
    resolve (...fragments: string[]): string
    get name (): string
    get parent (): string
    get shortPath (): string

    get exists (): boolean
    assert (): this
    delete (): this
    make   (): this

    in (...fragments: string[]): Directory
    get isDir (): boolean
    asDir <D extends Directory> (Ctor?: typeof Directory): D

    at (...fragments: string[]): File
    get isFile (): boolean
    asFile <F extends File> (Ctor?: typeof File):  F
  }

  export class File extends Path {
    path: string
    load (): any
    save (_1: any): any
  }

  export class Directory extends Path {
    constructor (_: string)
    path:    string
    subdir:  Function
    load:    Function
    save     (_1: any, _2: any)
    delete   ()
  }

  export class BinaryFile extends File {}
  export class TextFile   extends File {}

  export class JSONFormat {}
  export class JSONFile      extends TextFile {}
  export class JSONDirectory extends Directory {}

  export class YAMLFormat {}
  export class YAMLFile      extends TextFile {}
  export class YAMLDirectory extends Directory {}

  export class TOMLFormat {}
  export class TOMLFile      extends TextFile {}
  export class TOMLDirectory extends Directory {}

  export const withTmpDir: ContextWrapper

  export const withTmpFile: ContextWrapper

  export const getDirName = (url: URL) => string

  type ContextWrapper = (ContextWrapped)=>void
  type ContextWrapped = <T>(path: string)=>T

}
