declare namespace dokeres {
  class DockerImage {
    constructor(...args: any[]);
    build(...args: any[]): void;
    check(...args: any[]): void;
    ensure(...args: any[]): void;
    follow(...args: any[]): void;
    pull(...args: any[]): void;
  }
  function waitUntilLogsSay(container: any, expected: any, thenDetach: any): any;
}
