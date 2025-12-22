import type { StepsWith } from '../../index.ts';

/** TODO: A context for building and running containers
  * either via Podman/Buildah, or via Docker. */
export type OCI = {
  builder:   'buildah'|'docker'|unknown
  images:     Record<string, OCIImage>,
  runtime:   'podman'|'docker'|unknown
  containers: Record<string, OCIContainer>
};

/** A running container. */
export type OCIContainer = { name: string };

/** A container image. */
export type OCIImage = {
  name: string, tag: string, url: string, layers: OCILayer[], };

/** A layer of a container image. */
export type OCILayer = { command: string };

/** Define a container to run. */
export const ociContainer: StepsWith<string, OCI> =
  (_name, ..._opts) => { throw new Error('TODO') };

/** Define an image to pull or build. */
export const ociImage: StepsWith<string, OCI> =
  (_name, ..._opts) => { throw new Error('TODO') };

/** Define an image layer. */
export const ociLayer: StepsWith<string, OCILayer> =
  (_name, ..._opts) => { throw new Error('TODO') };

/** Define a distro (base layer + packages). */
export const distro: StepsWith<string, OCI> =
  (_name, ..._opts) => { throw new Error('TODO') };

/** Define a distro package. */
export const distroPkg: StepsWith<string, OCI> =
  (_name, ..._opts) => { throw new Error('TODO') };

