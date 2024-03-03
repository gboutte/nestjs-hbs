import { DynamicModule, Global, Module } from '@nestjs/common';
import { HandlebarsOptions } from './handlebars-options.interface';
import { HandlebarsService } from './handlebars.service';

@Global()
@Module({
  imports: [],
  providers: [HandlebarsService],
  exports: [HandlebarsService],
})
export class HandlebarsModule {
  static forRoot(handlebarsOptions: HandlebarsOptions): DynamicModule {
    return {
      module: HandlebarsModule,
      providers: [
        {
          provide: 'HANDLEBARS_PARAMETERS',
          useValue: handlebarsOptions,
        },
      ],
    };
  }
}
