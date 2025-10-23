import type { StepsWithName } from '../index.ts';

export type OCI = {
  images:     Record<string, Image>,
  containers: Record<string, Container>
};

export type Image = {
  /*TODO*/
};

export type Container = {
  /*TODO*/
};

export const container: StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };

export const image:     StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };

export const distro:    StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };

export const pk:        StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };

//export const every = (path, ...options: Option[]) => pipe(...options);
