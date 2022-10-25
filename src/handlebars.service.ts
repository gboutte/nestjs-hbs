import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as fs from "fs";
import Handlebars from "handlebars";
import * as path from "path";

@Injectable()
export class HandlebarsService {
  render(html: string, parameters: any = {}): string {
    Handlebars.registerHelper("base64ImageSrc", function (imagePath: string) {
      const bitmap = fs.readFileSync(
        path.join(process.cwd(), "templates/assets/img", imagePath)
      );
      const base64String = new Buffer(bitmap).toString("base64");

      return new Handlebars.SafeString(`data:image/png;base64,${base64String}`);
    });

    try {
      const template = Handlebars.compile(html);
      const result = template(parameters, {
        allowProtoMethodsByDefault: true,
        allowProtoPropertiesByDefault: true,
      });
      return result;
    } catch (err) {
      throw new InternalServerErrorException("Could not render template");
    }
  }

  renderFile(file: string, parameters: any = {}): string {
    let data;
    try {
      const fullpath = path.join(process.cwd(), "templates", file);
      data = fs.readFileSync(fullpath, "utf8");
    } catch (err) {
      throw new InternalServerErrorException("Could not render file");
    }
    return this.render(data, parameters);
  }
}
