import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import Handlebars from 'handlebars';
import * as path from 'path';
import { HandlebarsOptions } from './handlebars-options.interface';
import {
  HandlebarsConfigurationError,
  HandlebarsInvalidPathError,
  HandlebarsRenderError,
  HandlebarsTemplateNotFoundError,
} from './handlebars.error';

@Injectable()
export class HandlebarsService implements OnModuleInit {
  private readonly logger = new Logger(HandlebarsService.name);

  /**
   * Private Handlebars environment. Using the shared `Handlebars` singleton
   * would leak our helpers and partials into the host application and into any
   * other library that renders templates in the same process.
   */
  private readonly handlebars = Handlebars.create();

  private initialized = false;

  /**
   * Compiled templates, keyed by absolute path. One entry per file on disk, so
   * it cannot grow unbounded. Per instance, like the Handlebars environment
   * above. Disabled with `cache: false`.
   */
  private readonly templateCache = new Map<
    string,
    Handlebars.TemplateDelegate
  >();

  constructor(
    @Inject('HANDLEBARS_PARAMETERS') private options: HandlebarsOptions,
  ) {}

  onModuleInit(): void {
    this.initialize();
  }

  render(html: string, parameters: any = {}): string {
    this.initialize();

    return this.execute(this.compile(html), parameters);
  }

  renderFile(file: string, parameters: any = {}): string {
    if (this.options.templateDirectory === undefined) {
      throw new HandlebarsConfigurationError(
        'Option templateDirectory is not set',
      );
    }

    // Resolved before anything else so that a traversal attempt surfaces as
    // itself instead of being swallowed into a read or compile error.
    const fullpath = this.resolveWithin(
      path.join(process.cwd(), this.options.templateDirectory),
      file,
      'template',
    );

    this.initialize();

    return this.execute(this.compileFile(fullpath), parameters);
  }

  /**
   * Returns the compiled form of `fullpath`, reading and compiling it on the
   * first call only. Both steps are skipped on a hit, which is the point:
   * compilation is the expensive half of a render and its result is reusable.
   */
  private compileFile(fullpath: string): Handlebars.TemplateDelegate {
    const cached = this.templateCache.get(fullpath);
    if (cached !== undefined) {
      return cached;
    }

    let data: string;
    try {
      data = fs.readFileSync(fullpath, 'utf8');
    } catch (err) {
      throw new HandlebarsTemplateNotFoundError(
        `Could not read template file: ${fullpath}`,
        fullpath,
        { cause: err },
      );
    }

    const template = this.compile(data);

    if (this.options.cache ?? true) {
      this.templateCache.set(fullpath, template);
    }

    return template;
  }

  private compile(html: string): Handlebars.TemplateDelegate {
    try {
      return this.handlebars.compile(html, this.options.compileOptions ?? {});
    } catch (err) {
      throw new HandlebarsRenderError('Could not render template', {
        cause: err,
      });
    }
  }

  /**
   * `Handlebars.compile()` is lazy: it hands back a delegate that parses on its
   * first invocation and memoizes the result. So a parse error surfaces here
   * rather than in `compile()` — and caching the delegate is what turns that
   * parse into a one-off.
   */
  private execute(
    template: Handlebars.TemplateDelegate,
    parameters: any,
  ): string {
    try {
      return template(parameters, this.options.templateOptions ?? {});
    } catch (err) {
      throw new HandlebarsRenderError('Could not render template', {
        cause: err,
      });
    }
  }

  /**
   * Resolves `relative` against `root` and refuses anything that lands outside
   * of it. `path.join` alone does not confine: a `../` segment — or an absolute
   * path — walks straight out of the directory, which turns a template name
   * derived from user input into an arbitrary file read.
   *
   * The check is lexical, so a symlink pointing outside of `root` is still
   * followed. Confining those would mean resolving the real path, which only
   * works on files that already exist.
   */
  private resolveWithin(root: string, relative: string, label: string): string {
    const resolvedRoot = path.resolve(root);
    const resolved = path.resolve(resolvedRoot, relative);

    if (
      resolved !== resolvedRoot &&
      !resolved.startsWith(resolvedRoot + path.sep)
    ) {
      throw new HandlebarsInvalidPathError(
        `Invalid ${label} path: "${relative}" resolves outside of ${resolvedRoot}`,
        relative,
        resolvedRoot,
      );
    }

    return resolved;
  }

  /**
   * Registers helpers and partials once, on the first of `onModuleInit()` or a
   * `render()` call. The lazy guard keeps the service usable when it is built
   * by hand rather than resolved through the Nest container.
   */
  private initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    this.registerHelpers();
    this.registerPartials();
  }

  private registerHelpers(): void {
    this.handlebars.registerHelper(
      'base64ImageSrc',
      (imagePath: string): Handlebars.SafeString => {
        const bitmap = fs.readFileSync(
          this.resolveWithin(
            path.join(process.cwd(), 'templates/assets/img'),
            imagePath,
            'image',
          ),
        );
        const base64String = Buffer.from(bitmap).toString('base64');

        return new this.handlebars.SafeString(
          `data:image/png;base64,${base64String}`,
        );
      },
    );

    for (const helper of this.options.helpers ?? []) {
      this.handlebars.registerHelper(helper.name, helper.fn);
    }
  }

  private registerPartials(): void {
    if (this.options.partialDirectory === undefined) {
      return;
    }

    const partialPath = path.join(process.cwd(), this.options.partialDirectory);

    if (!fs.existsSync(partialPath)) {
      throw new HandlebarsConfigurationError(
        'Partial directory does not exist: ' + partialPath,
      );
    }

    const registered: string[] = [];

    for (const file of fs.readdirSync(partialPath)) {
      const filePath = path.join(partialPath, file);
      if (fs.statSync(filePath).isFile()) {
        const partialName = path.basename(file, path.extname(file));
        const partialContent = fs.readFileSync(filePath, 'utf8');

        this.handlebars.registerPartial(partialName, partialContent);
        registered.push(partialName);
      }
    }

    // A single line rather than one per file. What is worth reporting is the
    // name each partial ended up under — it is derived from the filename, which
    // is not obvious from the outside — not the fact that a loop ran.
    if (registered.length === 0) {
      this.logger.debug(`No partials found in ${partialPath}`);
    } else {
      this.logger.debug(`Registered partials: ${registered.join(', ')}`);
    }
  }
}
