export type ErrorName = 'TimeoutError' | 'AbortError' | 'EmitError' | 'Error';

export class ChannelError extends Error {
  declare name: ErrorName;

  constructor(name: ErrorName, message?: string) {
    super(message);
    this.name = name;
  }
}
