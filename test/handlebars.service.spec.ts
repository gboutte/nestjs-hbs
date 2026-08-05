import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import Handlebars from 'handlebars';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HandlebarsOptions } from '../src/handlebars-options.interface';
import {
  HandlebarsConfigurationError,
  HandlebarsError,
  HandlebarsInvalidPathError,
  HandlebarsRenderError,
  HandlebarsTemplateNotFoundError,
} from '../src/handlebars.error';
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
        HandlebarsRenderError,
      );
    });

    it('throws when handed something that is not a template', () => {
      const service = createService();

      // Handlebars rejects a non-string synchronously, unlike a parse error,
      // which it defers to the first invocation of the compiled delegate.
      expect(() => service.render(undefined as unknown as string)).toThrow(
        HandlebarsRenderError,
      );
    });

    it('keeps the Handlebars error as the cause', () => {
      const service = createService();

      try {
        service.render('{{#if condition}}never closed');
        expect.unreachable('render should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HandlebarsRenderError);
        // Handlebars points at the offending line and says what it expected.
        // That detail used to be flattened into the message by concatenation.
        expect((err as HandlebarsRenderError).cause).toBeInstanceOf(Error);
        expect(String((err as HandlebarsRenderError).cause)).toMatch(
          /Parse error on line 1/,
        );
      }
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
        HandlebarsConfigurationError,
      );
      expect(() => service.renderFile('hello.hbs')).toThrow(
        'Option templateDirectory is not set',
      );
    });

    it('throws when the template file does not exist', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      expect(() => service.renderFile('does-not-exist.hbs')).toThrow(
        HandlebarsTemplateNotFoundError,
      );
    });

    it('reports the file and the underlying fs error when the read fails', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      try {
        service.renderFile('does-not-exist.hbs');
        expect.unreachable('renderFile should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HandlebarsTemplateNotFoundError);
        const notFound = err as HandlebarsTemplateNotFoundError;

        // The old message was a bare 'Could not render file': no filename, no
        // way to tell an absent file from a permission problem.
        expect(notFound.templatePath).toBe(
          path.resolve(TEMPLATE_DIR, 'does-not-exist.hbs'),
        );
        expect(notFound.message).toContain('does-not-exist.hbs');
        expect((notFound.cause as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });

    it('renders a template nested inside templateDirectory', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      expect(service.renderFile('nested/deep.hbs', { name: 'John' })).toBe(
        'Deep John!',
      );
    });
  });

  describe('template cache', () => {
    const TMP_TEMPLATE_DIR = 'test/fixtures/tmp-templates';
    const tmpTemplate = path.join(TMP_TEMPLATE_DIR, 'volatile.hbs');
    const otherTemplate = path.join(TMP_TEMPLATE_DIR, 'other.hbs');

    beforeEach(() => {
      fs.mkdirSync(TMP_TEMPLATE_DIR, { recursive: true });
      fs.writeFileSync(tmpTemplate, 'first', 'utf8');
      fs.writeFileSync(otherTemplate, 'other', 'utf8');
    });

    afterEach(() => {
      fs.rmSync(TMP_TEMPLATE_DIR, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 50,
      });
    });

    it('reads and compiles a template once', () => {
      const service = createService({ templateDirectory: TMP_TEMPLATE_DIR });

      expect(service.renderFile('volatile.hbs')).toBe('first');

      fs.writeFileSync(tmpTemplate, 'second', 'utf8');

      // Still 'first': the second call served the cached template without
      // touching the filesystem.
      expect(service.renderFile('volatile.hbs')).toBe('first');
    });

    it('reads on every call when cache is false', () => {
      const service = createService({
        templateDirectory: TMP_TEMPLATE_DIR,
        cache: false,
      });

      expect(service.renderFile('volatile.hbs')).toBe('first');

      fs.writeFileSync(tmpTemplate, 'second', 'utf8');

      expect(service.renderFile('volatile.hbs')).toBe('second');
    });

    it('keys the cache per file', () => {
      const service = createService({ templateDirectory: TMP_TEMPLATE_DIR });

      expect(service.renderFile('volatile.hbs')).toBe('first');
      expect(service.renderFile('other.hbs')).toBe('other');
      expect(service.renderFile('volatile.hbs')).toBe('first');
    });

    it('still applies the parameters on a cache hit', () => {
      fs.writeFileSync(tmpTemplate, 'Hello {{name}}!', 'utf8');
      const service = createService({ templateDirectory: TMP_TEMPLATE_DIR });

      expect(service.renderFile('volatile.hbs', { name: 'John' })).toBe(
        'Hello John!',
      );
      expect(service.renderFile('volatile.hbs', { name: 'Jane' })).toBe(
        'Hello Jane!',
      );
    });

    it('does not share its cache between two instances', () => {
      const first = createService({ templateDirectory: TMP_TEMPLATE_DIR });
      expect(first.renderFile('volatile.hbs')).toBe('first');

      fs.writeFileSync(tmpTemplate, 'second', 'utf8');

      const second = createService({ templateDirectory: TMP_TEMPLATE_DIR });
      expect(second.renderFile('volatile.hbs')).toBe('second');
      expect(first.renderFile('volatile.hbs')).toBe('first');
    });

    it('does not cache a template that could not be read', () => {
      const service = createService({ templateDirectory: TMP_TEMPLATE_DIR });

      expect(() => service.renderFile('later.hbs')).toThrow(
        HandlebarsTemplateNotFoundError,
      );

      fs.writeFileSync(
        path.join(TMP_TEMPLATE_DIR, 'later.hbs'),
        'late',
        'utf8',
      );

      expect(service.renderFile('later.hbs')).toBe('late');
    });

    it('does not cache render() input', () => {
      const service = createService();

      // render() takes an arbitrary string; caching on it would let a caller
      // grow the map without bound.
      expect(service.render('Hello {{name}}', { name: 'John' })).toBe(
        'Hello John',
      );
      expect(service.render('Bye {{name}}', { name: 'John' })).toBe('Bye John');
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

    it('reports a traversal as a rejected input, not a missing file', () => {
      const service = createService({ templateDirectory: TEMPLATE_DIR });

      try {
        service.renderFile('../../../package.json');
        expect.unreachable('renderFile should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HandlebarsInvalidPathError);
        expect(err).not.toBeInstanceOf(HandlebarsTemplateNotFoundError);

        const invalid = err as HandlebarsInvalidPathError;
        expect(invalid.requestedPath).toBe('../../../package.json');
        expect(invalid.root).toBe(path.resolve(TEMPLATE_DIR));
      }
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

    // A fresh service per assertion: `initialize()` flips its guard before
    // registering, so a service whose initialization threw does not retry on
    // the next render.
    it('throws when partialDirectory does not exist', () => {
      expect(() =>
        createService({ partialDirectory: 'test/fixtures/nope' }).render(
          'anything',
        ),
      ).toThrow(HandlebarsConfigurationError);

      expect(() =>
        createService({ partialDirectory: 'test/fixtures/nope' }).render(
          'anything',
        ),
      ).toThrow(/Partial directory does not exist/);
    });

    it('renders without partials when partialDirectory is omitted', () => {
      expect(createService().render('Hello {{name}}', { name: 'John' })).toBe(
        'Hello John',
      );
    });

    it('reports an empty partialDirectory rather than staying silent', () => {
      const EMPTY_DIR = 'test/fixtures/tmp-partials';
      fs.mkdirSync(EMPTY_DIR, { recursive: true });

      const debug = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);

      try {
        createService({ partialDirectory: EMPTY_DIR }).onModuleInit();

        // The case where someone wonders why `{{> foo}}` is not found.
        expect(debug).toHaveBeenCalledTimes(1);
        expect(debug.mock.calls[0][0]).toContain('No partials found in');
      } finally {
        debug.mockRestore();
        fs.rmSync(EMPTY_DIR, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 50,
        });
      }
    });

    it('logs the registered names once, not one line per file', () => {
      const debug = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);

      try {
        createService({ partialDirectory: PARTIAL_DIR }).onModuleInit();

        // Two fixtures in the directory, still a single line.
        expect(debug).toHaveBeenCalledTimes(1);
        expect(debug.mock.calls[0][0]).toBe(
          'Registered partials: siteFooter, siteHeader',
        );
      } finally {
        debug.mockRestore();
      }
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
        HandlebarsConfigurationError,
      );
    });
  });

  describe('errors', () => {
    // The point of the hierarchy: one catch clause covers the library, and a
    // configuration mistake stays distinguishable from a runtime failure.
    it('lets a single catch clause cover every failure mode', () => {
      const cases = [
        () => createService().renderFile('hello.hbs'),
        () =>
          createService({ templateDirectory: TEMPLATE_DIR }).renderFile(
            'does-not-exist.hbs',
          ),
        () =>
          createService({ templateDirectory: TEMPLATE_DIR }).renderFile(
            '../../../package.json',
          ),
        () => createService().render('{{#if condition}}never closed'),
      ];

      for (const run of cases) {
        expect(run).toThrow(HandlebarsError);
      }
    });

    it('separates configuration errors from runtime errors', () => {
      const configuration = () => createService().renderFile('hello.hbs');
      const runtime = () =>
        createService().render('{{#if condition}}never closed');

      expect(configuration).toThrow(HandlebarsConfigurationError);
      expect(runtime).not.toThrow(HandlebarsConfigurationError);
      expect(runtime).toThrow(HandlebarsRenderError);
    });

    it('does not leak HTTP semantics into the thrown errors', () => {
      // Rendering also backs emails, PDFs and CLI output. Nothing thrown here
      // should carry a status code.
      try {
        createService().renderFile('hello.hbs');
        expect.unreachable('renderFile should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).not.toHaveProperty('status');
        expect(err).not.toHaveProperty('getStatus');
      }
    });

    it('names each error after its own class', () => {
      expect(new HandlebarsError('x').name).toBe('HandlebarsError');
      expect(new HandlebarsConfigurationError('x').name).toBe(
        'HandlebarsConfigurationError',
      );
      expect(new HandlebarsRenderError('x').name).toBe('HandlebarsRenderError');
      expect(new HandlebarsInvalidPathError('x', 'p', 'r').name).toBe(
        'HandlebarsInvalidPathError',
      );
      expect(new HandlebarsTemplateNotFoundError('x', 'p').name).toBe(
        'HandlebarsTemplateNotFoundError',
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
        HandlebarsRenderError,
      );
    });
  });
});
