import type { Client }     from './core-connect'
import type { Builder }    from './core-build'
import type { Deployment } from './core-deployment'

/** This function attaches a contract representation object to a deployment.
  * This sets the contract prefix to the deployment name, and provides defaults. */
export function attachToDeployment <C extends Client, T extends { context?: Deployment }> (
  self: T, context: Deployment
): T {
  self.context = context

  /** Default fields start out as getters that point to the corresponding field
    * on the context; but if you try to set them, they turn into normal properties
    * with the provided value. */
  const defineDefault = name => Object.defineProperty(self, name, {
    enumerable: true,
    get () {
      return context[name]
    },
    set (v: Builder) {
      Object.defineProperty(self, name, { enumerable: true, value: v })
      return v
    }
  })

  defineDefault('log')
  defineDefault('agent')
  defineDefault('builder')
  defineDefault('uploader')
  defineDefault('repository')
  defineDefault('revision')
  defineDefault('workspace')

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
