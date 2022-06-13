import open from 'open'
import onExit from 'signal-exit'

export * from '@hackbg/formati'
export * from '@hackbg/konzola'
export * from '@hackbg/kabinet'
export * from '@hackbg/komandi'
export * from '@hackbg/dokeres'
export * from '@hackbg/runspec'

export function entrypoint (
  url  = '',
  main = () => {/**/}
) {
  if (process.argv[1] === fileURLToPath(url)) {
    main(process.argv.slice(2)).then(()=>process.exit(0))
  }
}

export {
  open,
  onExit
}
