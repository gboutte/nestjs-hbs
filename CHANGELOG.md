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
- The published package now only contains `dist/`.

### Fixed
- A missing `partialDirectory` is now reported when the application starts rather than on
  the first render.

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
