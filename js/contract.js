const { readFileSync } = require('fs')
const { resolve } = require('path')

module.exports = module.exports.default = class SecretNetworkContract {

  // create subclass with methods based on the schema
  // TODO validate arguments with `ajv` etc.
  static withSchema (schema={}) {

    // extend SecretNetworkContract
    return class SecretNetworkContractWithSchema extends this {

      // read-only: the parsed schema
      static get schema () { return schema }

      // read-only: the queries generated from the schema
      get q () {
        return methodsFromSchema(
          this, this.constructor.schema.queryMsg, (self, methodName) => ({
            async [methodName] (args, agent = self.agent) {
              return await self.query(methodName, args, agent)
            }
          })
        )
      }

      // read-only: the transactions generated from the schema
      get tx () {
        return methodsFromSchema(
          this, this.constructor.schema.handleMsg, (self, methodName) => ({
            async [methodName] (args, agent = self.agent) {
              return await self.execute(methodName, args, agent)
            }
          })
        )
      }
    }

    function methodsFromSchema (self, schema, getWrappedMethod) {
      if (!schema) return null
      return schema.anyOf.reduce((methods, methodSchema)=>{
        const {description, required:[methodName]} = methodSchema
        const methodWrapper = getWrappedMethod(self, methodName)
        methodWrapper[methodName].description = description
        methodWrapper[methodName] = methodWrapper[methodName].bind(self)
        return Object.assign(methods, methodWrapper)
      }, {})
    }

  }

  static async fromCommit ({
    say = require('./say').mute(),
    name, commit, binary,
    buildOutputs = resolve(__dirname, '../../dist'),
    buildScript  = resolve(__dirname, '../../build/commit'),
    ...args
  }) {
    say = say.tag(` #${this.name}{${commit}}`)
    const binaryFullPath = resolve(buildOutputs, binary)
    if (!require('fs').existsSync(binaryFullPath)) { // Recompile binary if absent
      say.tag(` #building`)(binaryFullPath)
      const args = [ commit ]
      const opts = { stdio: 'inherit' }
      const build = require('child_process').spawnSync(buildScript, args, opts)
      say.tag(` #build-result(${binary})`)(build)
    }
    const label = `${commit} ${name} (${new Date().toISOString()})`
    return this.deploy({say, binary, label, name, ...args})
  }

  // todo measure gas
  static async deploy ({
    say = require('./say').mute(),
    agent, id, binary,
    name, label, data = {}
  }) {
    say = say.tag(` #${this.name}`)
    if (!id) { // if the contract is not uploaded, do it
      const upload = await agent.upload({ say: say.tag(` #upload`), binary })
      id = upload.codeId
      //await agent.waitForNextBlock()
    }
    const args = say.tag(` #instantiate`)({ id, label, data })
    const self = new this({say, binary, label, name, agent, id, data})
    await self.init()
    return self
  }

  constructor (properties = {}) {
    return Object.assign(this, properties)
  }

  async init () {
    const {id, label, data} = this
    const {address, hash} = await this.agent.instantiate({id, label, data})
    this.say.tag(` #instantiated`)({ address, hash })
    Object.assign(this, { address, hash })
  }

  async query (method = '', args = {}, agent = this.agent) {
    return await agent.query(this, method, args)
  }

  async execute (method = '', args = {}, agent = this.agent) {
    return await agent.execute(this, method, args)
  }

}
