export function mockBuilder (builder: any) {
  builder.spawn     = () => ({ on (event: any, callback: Function) { callback(0) } })
  builder.hashPath  = () => 'code hash ok'
  builder.prebuilt  = () => false
  builder.fetch     = () => Promise.resolve()
  builder.getGitDir = () => ({ present: true })
}
