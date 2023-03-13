import { Fadroma, FadromaCommands } from '@hackbg/fadroma'

export class MyCommands extends FadromaCommands {

  doStuff1 = this.command('do-stuff-1', 'do a thing', () => {
    // ...
  })

  doStuff2 = this.command('do-stuff-2', 'do another thing', () => {
    // ...
  })

}

export default (...args: any[]) => new MyCommands().run(args)
