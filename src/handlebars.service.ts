import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import Handlebars from 'handlebars';
import * as path from 'path';
import { HandlebarsOptions } from './handlebars-options.interface';

@Injectable()
export class HandlebarsService {
  private readonly logger = new Logger(HandlebarsService.name);
  constructor(
    @Inject('HANDLEBARS_PARAMETERS') private options: HandlebarsOptions,
  ) {}
  render(html: string, parameters: any = {}): string {
    Handlebars.registerHelper('base64ImageSrc', function (imagePath: string) {
      const bitmap = fs.readFileSync(
        path.join(process.cwd(), 'templates/assets/img', imagePath),
      );
      const base64String = Buffer.from(bitmap).toString('base64');

      return new Handlebars.SafeString(`data:image/png;base64,${base64String}`);
    });

    if (this.options.helpers !== undefined) {
      for (let helper of this.options.helpers) {
        Handlebars.registerHelper(helper.name, helper.fn);
      }
    }

    let compileOptions;
    if (this.options.compileOptions === undefined) {
      compileOptions = {};
    } else {
      compileOptions = this.options.compileOptions;
    }

    let templateOptions;
    if (this.options.templateOptions === undefined) {
      templateOptions = {};
    } else {
      templateOptions = this.options.templateOptions;
    }

    this.registerPartials();
    try {
      const template = Handlebars.compile(html, compileOptions);
      return template(parameters, templateOptions);
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

  private registerPartials(): void {
    if (this.options.partialDirectory !== undefined) {
      const partialPath = path.join(
        process.cwd(),
        this.options.partialDirectory,
      );

      if (!fs.existsSync(partialPath)) {
        throw new InternalServerErrorException(
          'Partial directory does not exist: ' + partialPath,
        );
      }
      const files = fs.readdirSync(partialPath);
      for (const file of files) {
        const filePath = path.join(partialPath, file);
        if (fs.statSync(filePath).isFile()) {
          const partialName = path.basename(file, path.extname(file));
          const partialContent = fs.readFileSync(filePath, 'utf8');
          this.logger.log('Registering partial: ' + partialName);

          Handlebars.registerPartial(partialName, partialContent);
        }
      }
    }
  }
}
