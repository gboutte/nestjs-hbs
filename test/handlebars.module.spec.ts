import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { HandlebarsModule } from '../src/handlebars.module';
import { HandlebarsService } from '../src/handlebars.service';

const OPTIONS = { templateDirectory: 'test/fixtures/templates' };

describe('HandlebarsModule', () => {
  describe('forRoot', () => {
    it('returns a DynamicModule bound to HandlebarsModule', () => {
      const dynamicModule = HandlebarsModule.forRoot(OPTIONS);

      expect(dynamicModule.module).toBe(HandlebarsModule);
    });

    it('exposes the options under the HANDLEBARS_PARAMETERS token', () => {
      const dynamicModule = HandlebarsModule.forRoot(OPTIONS);

      expect(dynamicModule.providers).toContainEqual({
        provide: 'HANDLEBARS_PARAMETERS',
        useValue: OPTIONS,
      });
    });
  });

  describe('dependency injection', () => {
    it('provides a HandlebarsService configured with the given options', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [HandlebarsModule.forRoot(OPTIONS)],
      }).compile();

      const service = moduleRef.get(HandlebarsService);

      expect(service).toBeInstanceOf(HandlebarsService);
      expect(service.renderFile('hello.hbs', { name: 'John' })).toBe(
        'Hello John!',
      );
    });

    it('is registered as a global module', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [HandlebarsModule.forRoot(OPTIONS)],
      }).compile();

      // @Global() means consumers get the service without re-importing the
      // module in every feature module.
      expect(moduleRef.get(HandlebarsService, { strict: false })).toBeDefined();
    });
  });
});
