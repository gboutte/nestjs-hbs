import { HelperDelegate } from 'handlebars';

export interface HandlebarsOptions {
  templateDirectory?: string;
  partialDirectory?: string;
  templateOptions?: RuntimeOptions;
  compileOptions?: CompileOptions;
  helpers?: HandlebarsHelper[];

  /**
   * Keep the compiled form of each file rendered through `renderFile()` in
   * memory, keyed by its absolute path. Compilation is the expensive part of a
   * render and the result is reusable, so this is on by default.
   *
   * There is no invalidation: a template edited on disk is only picked up after
   * a restart, which is already how `partialDirectory` behaves. Set this to
   * `false` while developing to read and compile on every call.
   *
   * The cache holds one entry per template file, so it is bounded by what is on
   * disk. `render()` is never cached — its input is an arbitrary string, and
   * keying a cache on that would let a caller grow it without limit.
   *
   * @default true
   */
  cache?: boolean;
}

interface HandlebarsHelper {
  name: string;
  fn: HelperDelegate;
}
