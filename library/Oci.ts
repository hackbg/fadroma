import type { Fn } from '../index.ts';
export default Oci;
/** TODO: A context for building and running containers
  * either via Podman/Buildah, or via Docker. */
interface Oci {
  builder:    Oci.Builder
  runtime:    Oci.Runtime
  images:     Record<string, Oci.Image>
  containers: Record<string, Oci.Container>
};
namespace Oci {
  /** Known container builders. */
  export type Builder   = 'buildah'|'docker'|unknown;
  /** Known container runtimes. */
  export type Runtime   = 'podman'|'docker'|unknown;
  /** A running container. */
  export type Container = { name: string };
  /** A container image. */
  export type Image     = { name: string, tag: string, url: string, layers: Layer[], };
  /** A layer of a container image. */
  export type Layer     = { command: string };
  /** Define a container to run. */
  export const Container: Fn.StepsWith<string, Oci> = (_name, ..._opts) => { throw new Error('TODO') };
  /** Define an image to pull or build. */
  export const Image:     Fn.StepsWith<string, Oci> = (_name, ..._opts) => { throw new Error('TODO') };
  /** Define an image layer. */
  export const Layer:     Fn.StepsWith<string, Layer> = (_name, ..._opts) => { throw new Error('TODO') };
  /** Define a distro (base layer + packages). */
  export function Distro (_name, ..._opts) {
    throw new Error('TODO')
  };
  export namespace Distro {
    /** Define a distro package. */
    export const Package: Fn.StepsWith<string, Oci> = (_name, ..._opts) => { throw new Error('TODO') };
  }
}
