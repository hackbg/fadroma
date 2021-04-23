export async function build (CONTRACTS, options = {}) {
  console.log('hi')
  const { task      = taskmaster()
        , builder   = new SecretNetwork.Builder()
        , workspace = __dirname
        , outputDir = resolve(workspace, 'artifacts') } = options

  // pull build container
  await pull('enigmampc/secret-contract-optimizer:latest')

  // build all contracts
  const binaries = {}
  await task.parallel('build project',
    ...Object.entries(CONTRACTS).map(([name, {crate}])=>
      task(`build ${name}`, async report => {
        binaries[name] = await builder.build({outputDir, workspace, crate})
      })))

  return binaries
}

export async function upload (CONTRACTS, options = {}) {
  const { task     = taskmaster()
        , binaries = await build() // if binaries are not passed, build 'em
        } = options

  let { builder
      , conn = builder ? null : await SecretNetwork.localnet({stateBase}) } = options
  if (typeof conn === 'string') conn = await SecretNetwork[conn]({stateBase})
  if (!builder) builder = conn.builder

  const receipts = {}
  for (let contract of Object.keys(CONTRACTS)) {
    await task(`upload ${contract}`, async report => {
      const receipt = receipts[contract] = await builder.uploadCached(binaries[contract])
      console.log(`⚖️  compressed size ${receipt.compressedSize} bytes`)
      report(receipt.transactionHash) }) }

  return receipts
}
