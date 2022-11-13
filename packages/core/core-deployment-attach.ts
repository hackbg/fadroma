import type { Client }     from './core-client'
import type { Builder }    from './core-build'
import type { Deployment } from './core-deployment'

import { defineDefault } from './core-fields'

/** This function attaches a contract representation object to a deployment.
  * This sets the contract prefix to the deployment name, and provides defaults. */
export function attachToDeployment <
  C extends Client,
  T extends { context?: Deployment, log: { warn: Function } }
> (
  self: T, context: Deployment
): T {

  self.context = context
  //defineDefault(self, context, 'log')
  defineDefault(self, context, 'agent')
  defineDefault(self, context, 'builder')
  defineDefault(self, context, 'uploader')
  defineDefault(self, context, 'repository')
  defineDefault(self, context, 'revision')
  defineDefault(self, context, 'workspace')
  setPrefix(self, context.name)

  return self

  function setPrefix (self: T, value: string) {
    Object.defineProperty(self, 'prefix', {
      enumerable: true,
      get () { return self.context?.name },
      set (v: string) {
        if (v !== self.context?.name) {
          self.log.warn(`BUG: Overriding prefix from "${self.context?.name}" to "${v}"`)
        }
        setPrefix(self, v)
      }
    })
  }

}

