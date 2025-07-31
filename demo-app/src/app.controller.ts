import { Controller, Get } from '@nestjs/common';
import { HandlebarsService } from '@gboutte/nestjs-hbs';

@Controller()
export class AppController {
  constructor(private readonly hbsService: HandlebarsService) {}

  @Get()
  getHello(): string {
    return this.hbsService.renderFile('demo.hbs', { name: 'John Doe' });
  }
}
