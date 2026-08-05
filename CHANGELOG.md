# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased
### Changed
- Helpers and partials are now registered once, on module initialization, instead of on
  every `render()` call.
- Each `HandlebarsService` instance now uses its own Handlebars environment
  (`Handlebars.create()`), so its helpers and partials no longer leak into the host
  application or into other libraries sharing the global Handlebars instance.
- Partial registration is logged at `debug` level instead of `log`.
- Raised the `handlebars` peer dependency to `^4.7.9`, which fixes a critical advisory
  affecting every earlier 4.x release.
- The published package now only contains `dist/`, plus the README and the licence.
- Added an `exports` map. `@gboutte/nestjs-hbs` and `@gboutte/nestjs-hbs/package.json`
  stay reachable; deep paths such as `@gboutte/nestjs-hbs/dist/handlebars.service` no
  longer resolve.
- Releases are published with npm provenance, so each version carries a signed
  attestation linking it to the workflow run that built it.
- **Breaking.** The library no longer throws `InternalServerErrorException`. Rendering
  also backs emails, PDFs and CLI output, where an HTTP status has no meaning, and the
  HTTP exception made a startup misconfiguration indistinguishable from a runtime
  failure. Dedicated error classes are thrown instead — see *Added* below. Applications
  that relied on the exception reaching a controller and turning into a 500 now need to
  map these errors themselves.
- `renderFile` no longer reports every failure as `Could not render file`. The message
  now names the file, and the underlying `fs` error is kept in `cause`, so an absent file
  stays distinguishable from a permission or encoding problem.

### Added
- A `LICENSE` file. The package was already declared MIT but shipped without one.
- Dedicated error classes, all exported from the package root and all extending
  `HandlebarsError`, so a single `catch` clause covers the library:
  `HandlebarsConfigurationError` (missing option, missing directory — raised at startup),
  `HandlebarsTemplateNotFoundError`, `HandlebarsInvalidPathError` and
  `HandlebarsRenderError`.

### Fixed
- A missing `partialDirectory` is now reported when the application starts rather than on
  the first render.
- **Path traversal.** `renderFile` joined its argument onto the template directory without
  confining the result, so a `../` segment — or an absolute path — escaped the directory.
  An application deriving a template name from user input could be made to read any file
  the process could reach. Paths are now resolved and rejected if they land outside the
  template directory, which is also applied to the `base64ImageSrc` helper. The check is
  lexical: a symlink inside the template directory pointing outside of it is still
  followed.

## 0.2.0 - 2025-07-31
### Added
- Added support for `partials` in the configuration.

## 0.1.0 - 2025-06-14

## 0.0.15 - 2023-08-25
### Changed
- clean peerDependencies

## 0.0.14 - 2023-08-25
### Changed
- Updated dependencies

## 0.0.13 - 2023-08-25
### Changed
- Updated dependencies
