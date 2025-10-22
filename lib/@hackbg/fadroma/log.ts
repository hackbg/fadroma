/** Logging interface. */
export type Logger = { /* TODO */ };

export const logger = ({ to = console, name }): Logger =>
  Object.assign(to, { name });
