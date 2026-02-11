/** Semantic version. */
export type Semver = string;

/** Versioned component. */
export type Versioned<V = Semver> = { /* The version. */ version: V };

