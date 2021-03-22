import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve, basename } from 'path'
import { spawnSync } from 'child_process'
import { homedir} from 'os'
import Docker from 'dockerode'

export default class SecretNetworkBuilder {

  constructor ({
    say = mute(),
    buildRoot,
    buildOutputs = resolve(buildRoot, 'outputs'),
    buildCommand,
    agent
  }) {
    Object.assign(this, { say, agent, buildCommand, buildOutputs })
  }

  async deploy (
    cls,
    data = {},
    options = {}
  ) {
    const {
      name,
      commit = 'main',
      agent  = this.agent,
      output = resolve(this.buildOutputs, `${commit}-${name}.wasm`),
      binary = await this.build(commit, output),
      label  = basename(binary),
      upload = await this.upload(binary, agent),
      codeId = upload.codeId
    } = options
    return new cls({ id: codeId, label, data })
  }

  async build (commit, binary) {
    const say = this.say.tag('build')
    if (existsSync(binary)) {
      say('cached', { binary }) // TODO compare against checksums
    } else {
      say('building', { binary })
      const [{Error:err, StatusCode:code}, container] = await buildInDocker({
        commit,
        outputs: this.buildOutputs
      })
      await container.remove()
      if (err) throw new Error(err)
      if (code !== 0) throw new Error(`build exited with status ${code}`)
      say('built', { binary })
    }
    return binary
  }

  async upload (binary) {
    const say = this.say.tag('upload')

    // check for past upload receipt
    const chainId = await this.agent.API.getChainId()
    const receipt = `${binary}.${chainId}.upload`
    if (existsSync(receipt)) {
      const result = JSON.parse(await readFile(receipt, 'utf8'))
      return say.tag('cached')(result)
    }

    // if no receipt, upload anew
    say.tag('uploading')(binary)
    const result = await this.agent.API.upload(await readFile(binary), {})
    say.tag('uploaded')(result)
    await writeFile(receipt, JSON.stringify(result), 'utf8')
    return result
  }

}

function buildInDocker ({
  builder = 'hackbg/secret-contract-optimizer:latest',
  origin  = 'git@github.com:hackbg/sienna-secret-token.git',
  commit,
  name,
  user = 'root',
  outputs
}={}) {
  return new Docker().run(
    builder,
    ['-c', [
      `whoami && pwd && ls / && cat /root/.ssh/known_hosts`,
      `mkdir -p /contract`,
      `cd /contract`,
      `git clone --recursive -n ${origin} .`,
      `git checkout ${commit}`,
      `git submodule update`,
      `chown -r ${user} /contract`,
      `/entrypoint.sh ${name}`,
      `ls -al`,
      `mv ${name}.wasm /output/${commit}-${name}.wasm`
    ].join(' && ')],
    process.stdout,
    { Env: [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
           , 'CARGO_TERM_VERBOSE=true'
           , 'CARGO_HTTP_TIMEOUT=240' ]
    , Entrypoint: '/bin/sh'
    , HostConfig:
      { Binds:
        [ `${outputs}:/output:rw`
        , `/root/.ssh/id_rsa:/root/.ssh/id_rsa:ro`
        , `/root/.ssh/known_hosts:/root/.ssh/known_hosts:ro`
        , `sienna_cache_${commit}:/code/target`
        , `registry_cache_${commit}:/usr/local/cargo/` ] } })
}
