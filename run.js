export const cargo = (...args) => run(
  'cargo',
  '--color=always',
  ...args
)

export const run = (cmd = '', ...args) => {
  process.stderr.write(`\n🏃 running:\n${cmd} ${args.join(' ')}\n\n`)
  return execFileSync(cmd, [...args], {stdio:'inherit'})
}

export const clear = () => {
  if (process.env.TMUX) run(
    'sh',
    '-c',
    'clear && tmux clear-history'
  )
}

export const outputOf = (cmd = '', ...args) => {
  process.stderr.write(`\n🏃 running:\n${cmd} ${args.join(' ')}\n\n`)
  return String(execFileSync(cmd, [...args]))
}

export function entrypoint (
  url  = '',
  main = () => {}
) {
  if (process.argv[1] === fileURLToPath(url)) {
    main(process.argv.slice(2)).then(()=>process.exit(0))
  }
}
