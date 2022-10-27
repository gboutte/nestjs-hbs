import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import * as fs from "fs";
import Handlebars from "handlebars";
import * as path from "path";
import { HandlebarsOptions } from "./handlebars-options.interface";

@Injectable()
export class HandlebarsService {
  constructor(
    @Inject("HANDLEBARS_PARAMETERS") private options: HandlebarsOptions
  ) {}
  render(html: string, parameters: any = {}): string {
    Handlebars.registerHelper("base64ImageSrc", function (imagePath: string) {
      const bitmap = fs.readFileSync(
        path.join(process.cwd(), "templates/assets/img", imagePath)
      );
      const base64String = new Buffer(bitmap).toString("base64");

      return new Handlebars.SafeString(`data:image/png;base64,${base64String}`);
    });

    try {
      const template = Handlebars.compile(html, this.options.compileOptions);
      const result = template(parameters, this.options.templateOptions);
      return result;
    } catch (err) {
      throw new InternalServerErrorException("Could not render template");
    }
  }

  renderFile(file: string, parameters: any = {}): string {
    let data;
    try {
      const fullpath = path.join(
        process.cwd(),
        this.options.templateDirectory,
        file
      );
      data = fs.readFileSync(fullpath, "utf8");
    } catch (err) {
      throw new InternalServerErrorException("Could not render file");
    }
    return this.render(data, parameters);
  }
}
