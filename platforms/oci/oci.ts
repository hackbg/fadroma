export {
  OCI,
  OCIConnection,
  OCIAgent,
} from './oci-connection'
export {
  OCIImage,
  OCIContainer,
  toLogLabel
} from './oci-program'

import { OCI } from './oci-connection'
export async function connect (...args: ConstructorParameters<typeof OCI>) {
  if (!args[0]) args[0] = {} as any
  return new OCI(...args)
}
