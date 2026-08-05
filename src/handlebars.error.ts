/**
 * Base class for every error thrown by this library.
 *
 * Rendering a template is not an HTTP concern: it backs emails, PDFs, CLI
 * output and microservice payloads just as often as it backs a controller.
 * Throwing `InternalServerErrorException` from those contexts is semantically
 * wrong, and it makes a startup misconfiguration indistinguishable from a
 * runtime failure. Consumers that *are* behind HTTP can map these onto the
 * status codes they want.
 *
 * `catch (err) { if (err instanceof HandlebarsError) ... }` catches all of them.
 */
export class HandlebarsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'HandlebarsError';
  }
}

/**
 * The module was set up incorrectly — a missing option, a directory that is not
 * there. These are deployment-time problems, not request-time ones: they are
 * raised from `onModuleInit`, so the application fails to boot rather than
 * failing on the first render.
 */
export class HandlebarsConfigurationError extends HandlebarsError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'HandlebarsConfigurationError';
  }
}

/**
 * A template path resolved outside of its root directory. Kept separate from
 * {@link HandlebarsTemplateNotFoundError} because the two want opposite
 * handling: a traversal attempt is a rejected input, not a missing resource.
 */
export class HandlebarsInvalidPathError extends HandlebarsError {
  constructor(
    message: string,
    /** The offending path, exactly as it was passed in. */
    readonly requestedPath: string,
    /** The absolute directory the path was required to stay inside of. */
    readonly root: string,
  ) {
    super(message);
    this.name = 'HandlebarsInvalidPathError';
  }
}

/**
 * The template file could not be read. The underlying `fs` error is kept in
 * `cause`, so the actual reason — absent, permissions, encoding — survives.
 */
export class HandlebarsTemplateNotFoundError extends HandlebarsError {
  constructor(
    message: string,
    /** Absolute path that could not be read. */
    readonly templatePath: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'HandlebarsTemplateNotFoundError';
  }
}

/**
 * Handlebars failed to compile or to execute the template. The original
 * Handlebars error is kept in `cause`.
 */
export class HandlebarsRenderError extends HandlebarsError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'HandlebarsRenderError';
  }
}
