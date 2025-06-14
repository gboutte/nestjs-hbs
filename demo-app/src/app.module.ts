import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { HandlebarsModule } from '@gboutte/nestjs-hbs';
@Module({
  imports: [
    HandlebarsModule.forRoot({
      templateDirectory: 'templates',
      compileOptions: {},
      templateOptions: {},
    })
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
