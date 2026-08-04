import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import Handlebars from 'handlebars';
import * as path from 'path';
import { HandlebarsOptions } from './handlebars-options.interface';

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

  constructor(
    @Inject('HANDLEBARS_PARAMETERS') private options: HandlebarsOptions,
  ) {}

  onModuleInit(): void {
    this.initialize();
  }

  render(html: string, parameters: any = {}): string {
    this.initialize();

    try {
      const template = this.handlebars.compile(
        html,
        this.options.compileOptions ?? {},
      );
      return template(parameters, this.options.templateOptions ?? {});
    } catch (err) {
      throw new InternalServerErrorException(
        'Could not render template: ' + err,
      );
    }
  }

  renderFile(file: string, parameters: any = {}): string {
    let data;
    if (this.options.templateDirectory === undefined) {
      throw new InternalServerErrorException(
        'Option templateDirectory is not set',
      );
    }

    try {
      const fullpath = path.join(
        process.cwd(),
        this.options.templateDirectory,
        file,
      );
      data = fs.readFileSync(fullpath, 'utf8');
    } catch (err) {
      throw new InternalServerErrorException('Could not render file');
    }
    return this.render(data, parameters);
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
          path.join(process.cwd(), 'templates/assets/img', imagePath),
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
      throw new InternalServerErrorException(
        'Partial directory does not exist: ' + partialPath,
      );
    }

    for (const file of fs.readdirSync(partialPath)) {
      const filePath = path.join(partialPath, file);
      if (fs.statSync(filePath).isFile()) {
        const partialName = path.basename(file, path.extname(file));
        const partialContent = fs.readFileSync(filePath, 'utf8');
        this.logger.debug('Registering partial: ' + partialName);

        this.handlebars.registerPartial(partialName, partialContent);
      }
    }
  }
}
