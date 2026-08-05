import { InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import Handlebars from 'handlebars';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    it('renders a template nested inside templateDirectory', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      expect(service.renderFile('nested/deep.hbs', { name: 'John' })).toBe(
        'Deep John!',
      );
    });
  });

  describe('renderFile path confinement', () => {
    // package.json sits at the repository root, two levels above the fixtures:
    // a readable file that must stay unreachable through renderFile.
    const escapes = [
      '../../../package.json',
      'nested/../../../package.json',
      './../../../package.json',
      path.resolve('package.json'),
    ];

    for (const file of escapes) {
      it(`refuses "${file}"`, () => {
        const service = createService({ templateDirectory: TEMPLATE_DIR });

        expect(() => service.renderFile(file)).toThrow(/resolves outside of/);
      });
    }

    it('refuses an escape even when the target does not exist', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      // Without confinement this would fail as a read error, which would hide
      // the traversal behind a generic message.
      expect(() => service.renderFile('../../../nope.hbs')).toThrow(
        /resolves outside of/,
      );
    });

    // Guards the `root + path.sep` part of the check: a bare startsWith(root)
    // would let "templates-sibling" through because it shares the prefix.
    it('refuses a sibling directory sharing the same prefix', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      expect(() =>
        service.renderFile('../templates-sibling/hello.hbs'),
      ).toThrow(/resolves outside of/);
    });

    it('allows a path that normalizes back into the directory', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      expect(service.renderFile('nested/../hello.hbs', { name: 'John' })).toBe(
        'Hello John!',
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

  describe('initialization', () => {
    const TMP_PARTIAL_DIR = 'test/fixtures/tmp-partials';
    const tmpPartial = path.join(TMP_PARTIAL_DIR, 'volatile.hbs');

    beforeEach(() => {
      fs.mkdirSync(TMP_PARTIAL_DIR, { recursive: true });
      fs.writeFileSync(tmpPartial, 'first', 'utf8');
    });

    afterEach(() => {
      // maxRetries/retryDelay: Windows can still hold a handle on a file that
      // was written a few milliseconds earlier and answers EBUSY.
      fs.rmSync(TMP_PARTIAL_DIR, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 50,
      });
    });

    it('reads the partial directory once, not on every render', () => {
      const service = createService({ partialDirectory: TMP_PARTIAL_DIR });

      expect(service.render('{{> volatile}}')).toBe('first');

      fs.writeFileSync(tmpPartial, 'second', 'utf8');

      // Still 'first': the partial was read during initialization, so this
      // render does not touch the filesystem again.
      expect(service.render('{{> volatile}}')).toBe('first');
    });

    it('registers partials on onModuleInit, before the first render', () => {
      const service = createService({ partialDirectory: TMP_PARTIAL_DIR });
      service.onModuleInit();

      fs.writeFileSync(tmpPartial, 'second', 'utf8');

      expect(service.render('{{> volatile}}')).toBe('first');
    });

    it('is idempotent when onModuleInit runs before a render', () => {
      const service = createService({
        partialDirectory: TMP_PARTIAL_DIR,
        helpers: [{ name: 'idem', fn: () => 'ok' }],
      });

      service.onModuleInit();
      service.onModuleInit();

      expect(service.render('{{idem}} {{> volatile}}')).toBe('ok first');
    });

    it('surfaces a missing partialDirectory at startup', () => {
      const service = createService({ partialDirectory: 'test/fixtures/nope' });

      expect(() => service.onModuleInit()).toThrow(
        /Partial directory does not exist/,
      );
    });
  });

  describe('isolation from the global Handlebars environment', () => {
    it('keeps its helpers off the global instance', () => {
      const service = createService({
        helpers: [{ name: 'globalLeakProbe', fn: () => 'leaked' }],
      });
      service.onModuleInit();

      expect(Handlebars.helpers['globalLeakProbe']).toBeUndefined();
      expect(Handlebars.helpers['base64ImageSrc']).toBeUndefined();
    });

    it('keeps its partials off the global instance', () => {
      const service = createService({ partialDirectory: PARTIAL_DIR });
      service.onModuleInit();

      expect(Handlebars.partials['siteHeader']).toBeUndefined();
    });

    it('does not let two instances overwrite each other', () => {
      const first = createService({
        helpers: [{ name: 'whoami', fn: () => 'first' }],
      });
      const second = createService({
        helpers: [{ name: 'whoami', fn: () => 'second' }],
      });

      expect(first.render('{{whoami}}')).toBe('first');
      expect(second.render('{{whoami}}')).toBe('second');
      expect(first.render('{{whoami}}')).toBe('first');
    });

    it('does not let one instance see another instance partials', () => {
      const withPartials = createService({ partialDirectory: PARTIAL_DIR });
      const withoutPartials = createService();

      expect(withPartials.render('{{> siteHeader}}')).toBe('[header]');
      expect(() => withoutPartials.render('{{> siteHeader}}')).toThrow(
        InternalServerErrorException,
      );
    });
  });
});
