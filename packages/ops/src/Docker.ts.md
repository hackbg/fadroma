#### Docker backend

These are the endpoints from [Dockerode](https://github.com/apocas/dockerode)
that are used to instantiate a chain locally and to build contracts in a container.
* **Mock** in [/test/mocks.ts](../test/mocks.ts)

```typescript
export interface IDocker {
  getImage (): {
    inspect (): Promise<any>
  }
  pull (image: any, callback: Function): void
  modem: {
    followProgress (
      stream:   any,
      callback: Function,
      progress: Function
    ): any
  }
  getContainer (id: any): {
    id: string,
    start (): Promise<any>
  }
  createContainer (options: any): {
    id: string
    logs (_: any, callback: Function): void
  }
}
```

