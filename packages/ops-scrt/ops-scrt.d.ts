/**
 
  Fadroma Ops for Secret Network
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

  Based on:
    - https://hub.docker.com/r/enigmampc/localsecret
    - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/release.Dockerfile
    - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/dockerfiles/dev-image.Dockerfile
    - https://github.com/scrtlabs/SecretNetwork/blob/7e7c769bce0fcaea396f96407a0a5967679c6285/deployment/docker/devimage/bootstrap_init_no_stop.sh ???

*/
import { Dokeres } from '@hackbg/dokeres';
import { DockerDevnet, RemoteDevnet, DevnetPortMode, DockerBuilder, RawBuilder } from '@fadroma/ops';
export * from '@fadroma/ops';
export declare const __dirname: string;
export default class SecretNetwork {
    static getBuilder: typeof getScrtBuilder;
    static getDevnet: typeof getScrtDevnet;
}
export interface ScrtBuilderOptions {
    rebuild: boolean;
    caching: boolean;
    raw: boolean;
    managerUrl: string | URL;
    image: string;
    dockerfile: string;
    script: string;
    service: string;
    noFetch: boolean;
    toolchain: string;
}
export declare function getScrtBuilder({ rebuild, caching, raw, managerUrl, image, dockerfile, service, script, toolchain, noFetch }?: Partial<ScrtBuilderOptions>): ScrtRawBuilder | ScrtDockerBuilder;
export declare class ScrtRawBuilder extends RawBuilder {
}
export declare class ScrtDockerBuilder extends DockerBuilder {
    static dockerfile: string;
    static script: string;
    static service: string;
    constructor({ caching, image, dockerfile, script, service }?: Partial<ScrtBuilderOptions>);
}
export declare type ScrtDevnetVersion = '1.2' | '1.3';
export declare class ScrtDevnet extends DockerDevnet {
    static dockerfiles: Record<ScrtDevnetVersion, string>;
    static dockerTags: Record<ScrtDevnetVersion, string>;
    static portModes: Record<ScrtDevnetVersion, DevnetPortMode>;
    static initScriptName: string;
    static managerScriptName: string;
}
export declare function getScrtDevnet(version: ScrtDevnetVersion, managerURL?: string, chainId?: string, dokeres?: Dokeres): DockerDevnet | RemoteDevnet;
