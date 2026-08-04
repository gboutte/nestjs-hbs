import { InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { HandlebarsOptions } from '../src/handlebars-options.interface';
import { HandlebarsService } from '../src/handlebars.service';

const TEMPLATE_DIR = 'test/fixtures/templates';
const PARTIAL_DIR = 'test/fixtures/partials';

// The service takes its options through a single injected token, so building it
// by hand keeps these unit tests free of a DI container. The wiring itself is
// covered in handlebars.module.spec.ts.
function createService(options: HandlebarsOptions = {}): HandlebarsService {
  return new HandlebarsService(options);
}

// NOTE: HandlebarsService registers helpers and partials on the *global*
// Handlebars instance, so anything registered by one test stays visible to the
// next one. Every helper and partial below therefore uses a name unique to its
// own test. See tmp_todo.md #2 — once the service switches to
// `Handlebars.create()`, that constraint disappears.

describe('HandlebarsService', () => {
  describe('render', () => {
    it('interpolates the parameters into the template', () => {
      expect(createService().render('Hello {{name}}!', { name: 'John' })).toBe(
        'Hello John!',
      );
    });

    it('renders an empty string for a missing parameter', () => {
      expect(createService().render('Hello {{name}}!')).toBe('Hello !');
    });

    it('escapes HTML by default and leaves triple-stache untouched', () => {
      const service = createService();
      const parameters = { value: '<b>bold</b>' };

      expect(service.render('{{value}}', parameters)).toBe(
        '&lt;b&gt;bold&lt;/b&gt;',
      );
      expect(service.render('{{{value}}}', parameters)).toBe('<b>bold</b>');
    });

    it('forwards compileOptions to Handlebars.compile', () => {
      const service = createService({ compileOptions: { noEscape: true } });

      expect(service.render('{{value}}', { value: '<b>' })).toBe('<b>');
    });

    it('forwards templateOptions to the compiled template', () => {
      const service = createService({
        templateOptions: { helpers: { shout: () => 'HEY' } },
      });

      expect(service.render('{{shout}}')).toBe('HEY');
    });

    it('registers the helpers declared in the options', () => {
      const service = createService({
        helpers: [
          { name: 'renderUpper', fn: (value: string) => value.toUpperCase() },
        ],
      });

      expect(service.render('{{renderUpper name}}', { name: 'john' })).toBe(
        'JOHN',
      );
    });

    it('throws when the template cannot be parsed', () => {
      const service = createService();

      expect(() => service.render('{{#if condition}}never closed')).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('renderFile', () => {
    it('renders a template read from templateDirectory', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      expect(service.renderFile('hello.hbs', { name: 'John' })).toBe(
        'Hello John!',
      );
    });

    it('throws when templateDirectory is not configured', () => {
      const service = createService();

      expect(() => service.renderFile('hello.hbs')).toThrow(
        'Option templateDirectory is not set',
      );
    });

    it('throws when the template file does not exist', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      expect(() => service.renderFile('does-not-exist.hbs')).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('partials', () => {
    it('registers every file in partialDirectory under its basename', () => {
      const service = createService({
        templateDirectory: TEMPLATE_DIR,
        partialDirectory: PARTIAL_DIR,
      });

      expect(service.renderFile('with-partial.hbs', { name: 'John' })).toBe(
        '[header] / John',
      );
    });

    it('passes the current context down to the partial', () => {
      const service = createService({ partialDirectory: PARTIAL_DIR });

      expect(service.render('{{> siteFooter}}', { name: 'John' })).toBe(
        '[footer John]',
      );
    });

    it('throws when partialDirectory does not exist', () => {
      const service = createService({ partialDirectory: 'test/fixtures/nope' });

      expect(() => service.render('anything')).toThrow(
        /Partial directory does not exist/,
      );
    });

    it('renders without partials when partialDirectory is omitted', () => {
      expect(createService().render('Hello {{name}}', { name: 'John' })).toBe(
        'Hello John',
      );
    });
  });
});
