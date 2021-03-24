import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { resolve, basename } from 'path'
import { spawnSync } from 'child_process'
import { homedir} from 'os'
import Docker from 'dockerode'

export default class SecretNetworkBuilder {

  constructor ({ say = mute(), outputDir, agent }) {
    Object.assign(this, { say, agent, outputDir })
  }

  async deploy (
    cls,
    data = {},
    options = {}
  ) {
    const {
      name,
      repo,
      commit,
      output = resolve(this.outputDir, `${commit}-${name}.wasm`),
      binary = await this.build({name, repo, commit, output}),
      label  = `${+new Date()}-${basename(binary)}`,
      agent  = this.agent,
      upload = await this.upload(binary, agent),
      codeId = upload.codeId,
      say = muted()
    } = options
    return new cls({codeId, agent, say}).init({label, data})
  }

  async build ({name, repo, commit, output}) {
    const say = this.say.tag(`build(${name}@${commit})`)
    if (existsSync(output)) {
      say.tag('cached')(output) // TODO compare against checksums
    } else {
      say.tag('building')(output)
      const { outputDir } = this
      const [{Error:err, StatusCode:code}, container] =
        (commit === 'HEAD')
        ? await buildWorkingTree({ name, repo, outputDir })
        : await buildCommit({ name, commit, outputDir })
      await container.remove()
      if (err) throw new Error(err)
      if (code !== 0) throw new Error(`build exited with status ${code}`)
      say.tag('built')(output)
    }
    return output
  }

  async upload (binary) {
    const say = this.say.tag(`upload(${basename(binary)})`)

    // check for past upload receipt
    const chainId = await this.agent.API.getChainId()
    const receipt = `${binary}.${chainId}.upload`
    say({receipt})
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
  repo,
  name,
  outputDir,
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
                   , `${outputDir}:/output:rw`
                   , `${repo}:/contract:rw` ] } })

export const buildCommit = ({
  builder = 'hackbg/secret-contract-optimizer:latest',
  buildAs = 'root',
  origin  = 'git@github.com:hackbg/sienna-secret-token.git',
  commit,
  name,
  outputDir,
  buildCommand = ['-c', buildCommands(origin, commit, name, buildAs).join(' && ')],
}={}) => new Docker()
  .run(builder
      , buildCommand
      , process.stdout
      , { Env: buildEnv()
        , Tty: true
        , AttachStdin: true
        , Entrypoint: '/bin/sh'
        , HostConfig:
          { Binds: [ `sienna_cache_${commit}:/code/target`
                   , `cargo_cache_${commit}:/usr/local/cargo/`
                   , `${outputDir}:/output:rw`
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
