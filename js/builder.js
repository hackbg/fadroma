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
    buildCmd,
    agent
  }) {
    Object.assign(this, { say, agent, buildCmd, buildOutputs })
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
      binary = await this.build(name, commit, output),
      label  = basename(binary),
      upload = await this.upload(binary, agent),
      codeId = upload.codeId
    } = options
    return new cls({ id: codeId, label, data })
  }

  async build (name, commit, binary) {
    const say = this.say.tag('build')
    if (existsSync(binary)) {
      say('cached', { binary }) // TODO compare against checksums
    } else {
      say('building', { binary })
      const [{Error:err, StatusCode:code}, container] = await buildCommit({
        name,
        commit,
        buildOutputs: this.buildOutputs
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

export const buildWorkingTree = ({
  builder = 'hackbg/secret-contract-optimizer:latest',
  buildAs = 'root',
  projectRoot,
  name,
  buildOutputs,
} = {}) => new Docker()
  .run(builder
      , [name, 'HEAD']
      , process.stdout
      , { Env: buildEnv()
        , Tty: true
        , AttachStdin: true
        , HostConfig:
          { Binds: [ `sienna_cache_worktree:/code/target`
                   , `cargo_cache_worktree:/usr/local/cargo/`
                   , `${buildOutputs}:/output:rw`
                   , `${projectRoot}:/contract:rw` ] } })

export const buildCommit = ({
  builder  = 'hackbg/secret-contract-optimizer:latest',
  buildAs  = 'root',
  buildCmd = ['-c', buildCommands(origin, commit, name, buildAs).join(' && ')],
  origin   = 'git@github.com:hackbg/sienna-secret-token.git',
  commit,
  name,
  buildOutputs,
}={}) => new Docker()
  .run(builder
      , buildCmd
      , process.stdout
      , { Env: buildEnv()
        , Tty: true
        , AttachStdin: true
        , Entrypoint: '/bin/sh'
        , HostConfig:
          { Binds: [ `sienna_cache_${commit}:/code/target`
                   , `cargo_cache_${commit}:/usr/local/cargo/`
                   , `${buildOutputs}:/output:rw`
                   , `${resolve(homedir(), '.ssh')}:/root/.ssh:ro` ] } })

export const buildCommands = (origin, commit, name, buildAs) =>
  [ `mkdir -p /contract && cd /contract`   // establish working directory
  , `git clone --recursive -n ${origin} .` // get the code
  , `git checkout ${commit}`               // checkout the expected commit
  , `git submodule update`                 // update submodules for that commit
  , `chown -R ${buildAs} /contract && ls`
  , `/entrypoint.sh ${name} ${commit}`
  , `ls -al`
  , `mv ${name}.wasm /output/${commit}-${name}.wasm` ]

export const buildEnv = () =>
  [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
  , 'CARGO_TERM_VERBOSE=true'
  , 'CARGO_HTTP_TIMEOUT=240' ]
