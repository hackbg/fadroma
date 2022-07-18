/// <reference types="node" />
import { Writable } from 'stream';
import Docker from 'dockerode';
export { Docker };
/** Defaults to the `DOCKER_HOST` environment variable. */
export declare const socketPath: string;
/** Follow the output stream from a Dockerode container until it closes. */
export declare function follow(dockerode: Docker, stream: any, callback: (data: any) => void): Promise<void>;
/** Wrapper around Dockerode.
  * Used to optain `DokeresImage` instances. */
export declare class Dokeres {
    /** By default, creates an instance of Dockerode
      * connected to env `DOCKER_HOST`. You can also pass
      * your own Dockerode instance or socket path. */
    constructor(dockerode?: Docker | string);
    readonly dockerode: Docker;
    image(name: string | null, dockerfile: string | null, extraFiles?: string[]): DokeresImage;
    container(id: string): Promise<DokeresContainer>;
}
/** Interface to a Docker image. */
export declare class DokeresImage {
    readonly dokeres: Dokeres | null;
    readonly name: string | null;
    readonly dockerfile: string | null;
    readonly extraFiles: string[];
    constructor(dokeres: Dokeres | null, name: string | null, dockerfile?: string | null, extraFiles?: string[]);
    get dockerode(): Docker;
    _available: any;
    ensure(): Promise<any>;
    /** Throws if inspected image does not exist locally. */
    check(): Promise<void>;
    /** Throws if inspected image does not exist in Docker Hub. */
    pull(): Promise<void>;
    build(): Promise<void>;
    run(name: any, options: any, command: any, entrypoint: any, outputStream?: any): Promise<DokeresContainer>;
}
export interface DokeresContainerOpts {
    env?: Record<string, string>;
    exposed?: string[];
    mapped?: Record<string, string>;
    readonly?: Record<string, string>;
    writable?: Record<string, string>;
    extra?: Record<string, unknown>;
    remove?: boolean;
}
export declare type DokeresCommand = string | string[];
/** Interface to a Docker container. */
export declare class DokeresContainer {
    readonly image: DokeresImage;
    readonly name: string;
    readonly options: DokeresContainerOpts;
    readonly command: DokeresCommand;
    readonly entrypoint: DokeresCommand;
    static create(image: DokeresImage, name?: string, options?: DokeresContainerOpts, command?: DokeresCommand, entrypoint?: DokeresCommand): Promise<DokeresContainer>;
    static run(image: DokeresImage, name?: string, options?: DokeresContainerOpts, command?: DokeresCommand, entrypoint?: DokeresCommand, outputStream?: Writable): Promise<DokeresContainer>;
    constructor(image: DokeresImage, name: string, options: DokeresContainerOpts, command: DokeresCommand, entrypoint: DokeresCommand);
    container: Docker.Container;
    get dockerode(): Docker;
    get dockerodeOpts(): Docker.ContainerCreateOptions;
    get id(): string;
    get shortId(): string;
    create(): Promise<this>;
    get warnings(): string[];
    start(): Promise<this>;
    get isRunning(): Promise<boolean>;
    kill(): Promise<this>;
    wait(): Promise<any>;
}
/** The caveman solution to detecting when the node is ready to start receiving requests:
  * trail node logs until a certain string is encountered */
export declare function waitUntilLogsSay(container: Docker.Container, expected: string, thenDetach?: boolean, waitSeconds?: number, logFilter?: (data: string) => boolean): Promise<unknown>;
