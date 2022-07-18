/** This builder talks to a remote build server over HTTP. */
export class ManagedBuilder extends CachingBuilder {
  Endpoint = Endpoint

  /** HTTP endpoint to request builds */
  manager: Endpoint

  constructor (options: { managerURL?: string } = {}) {
    super()
    const { managerURL = config.buildManager } = options
    this.manager = new this.Endpoint(managerURL)
  }

  /** Perform a managed build. */
  async build (source): Promise<Artifact> {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    // Request a build from the build manager
    const { workspace, crate, ref = 'HEAD' } = source
    const { location } = await this.manager.get('/build', { crate, ref })
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}
