import { HelperDelegate } from 'handlebars';

export interface HandlebarsOptions {
  templateDirectory?: string;
  templateOptions?: RuntimeOptions;
  compileOptions?: CompileOptions;
  helpers?: HandlebarsHelper[];
}

interface HandlebarsHelper {
  name: string;
  fn: HelperDelegate;
}
