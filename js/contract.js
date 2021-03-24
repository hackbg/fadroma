import { muted } from './say.js'

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { spawnSync } from 'child_process'

export default class SecretNetworkContract {

  // create subclass with methods based on the schema
  // TODO validate schema and req/res arguments with `ajv` etc.
  static withSchema (schema={}) {
    return extendWithSchema(this, schema)
  }

  constructor ({codeId, agent, say=muted()}={}) {
    return Object.assign(this, {codeId, agent, say})
  }

  async init ({label, data}) {
    const {codeId} = this
    this.say.tag(`init(${codeId})`)({label, data})
    const {address, hash} = await this.agent.instantiate({codeId, label, data})
    Object.assign(this, { address, hash })
    this.say.tag(`ready`)({ address, hash })
    return this
  }

  async query (method = '', args = {}, agent = this.agent) {
    return await agent.query(this, method, args)
  }

  async execute (method = '', args = {}, agent = this.agent) {
    return await agent.execute(this, method, args)
  }

}

// extend SecretNetworkContract
function extendWithSchema (SecretNetworkContract, schema) {

  return class SecretNetworkContractWithSchema extends SecretNetworkContract {

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

  // TODO: memoize this - methods aren't regenerated until the schema updates
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
