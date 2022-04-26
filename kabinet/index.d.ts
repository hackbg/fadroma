declare module '@hackbg/kabinet' {

  const Path: any

  class Directory {
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

  class JSONDirectory extends Directory {}

  class File {
    make: Function
    path: string
    exists (): boolean
    load (): any
    save (_1: any): any
  }

  class JSONFile extends File {
    constructor (_1: string, _2: string)
  }

}
