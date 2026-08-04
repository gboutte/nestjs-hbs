# @gboutte/nestjs-hbs

Render Handlebars templates from a NestJS service. Handy when you need HTML outside
of a view layer: emails, PDFs, or anything you generate and hand off somewhere else.

## Requirements

- Node 20 or later
- NestJS 9, 10 or 11
- Handlebars 4.7.9 or later

## Installation

```shell
npm install @gboutte/nestjs-hbs handlebars
```

`handlebars` and `@nestjs/common` are peer dependencies. Recent npm versions pull peers
in on their own, but naming handlebars explicitly keeps the version under your control.

## Configuration

Register the module once, usually in `AppModule`:

```ts
import { Module } from '@nestjs/common';
import { HandlebarsModule } from '@gboutte/nestjs-hbs';

@Module({
  imports: [
    HandlebarsModule.forRoot({
      templateDirectory: 'templates',
      partialDirectory: 'templates/partials',
    }),
  ],
})
export class AppModule {}
```

The module is global, so `HandlebarsService` can be injected anywhere without importing
`HandlebarsModule` again.

### Options

Every option can be left out.

| Option | Type | Description |
|---|---|---|
| `templateDirectory` | `string` | Folder holding the template files. `renderFile()` throws without it. |
| `partialDirectory` | `string` | Every file in this folder is registered as a partial. `myPartial.hbs` becomes `{{> myPartial}}`. Subfolders are skipped. |
| `helpers` | `{ name, fn }[]` | Helpers to register, each with a `name` and a `fn`. |
| `compileOptions` | `CompileOptions` | Handed to [`Handlebars.compile()`](https://handlebarsjs.com/api-reference/compilation.html#handlebars-compile-template-options). |
| `templateOptions` | `RuntimeOptions` | Handed to the compiled template as [runtime options](https://handlebarsjs.com/api-reference/runtime-options.html). |

Both directory options are resolved from `process.cwd()`, not from the file that
registers the module. Starting the app from another directory (pm2, a Docker image with
a different `WORKDIR`) will break them.

### Helpers

```ts
HandlebarsModule.forRoot({
  templateDirectory: 'templates',
  helpers: [
    { name: 'upper', fn: (value: string) => value.toUpperCase() },
    { name: 'day', fn: (date: Date) => date.toISOString().slice(0, 10) },
  ],
});
```

```hbs
{{upper name}} joined on {{day createdAt}}
```

### Partials

Given `templates/partials/header.hbs`, use it as `{{> header}}`. The partial receives the
current context, so `{{name}}` inside the partial resolves against the same data you
passed to `render()`.

### When registration happens

Helpers and partials are read once, at module startup. Editing a partial on disk does
nothing until the process restarts. A `partialDirectory` that does not exist makes the
application fail on boot instead of on the first render.

Every service instance gets its own Handlebars environment, so nothing registered here
leaks into the global `Handlebars` object or into other libraries rendering templates in
the same process.

## Usage

Inject `HandlebarsService` and call one of its two methods. Both run synchronously and
return a string.

| Method | Description |
|---|---|
| `renderFile(file, parameters?)` | Reads `file` from `templateDirectory`, extension included, then renders it. |
| `render(html, parameters?)` | Renders a template string. |

`parameters` is the context object the template reads from. It defaults to `{}`.

```ts
import { Controller, Get } from '@nestjs/common';
import { HandlebarsService } from '@gboutte/nestjs-hbs';

@Controller()
export class AppController {
  constructor(private readonly hbsService: HandlebarsService) {}

  @Get()
  fromFile(): string {
    return this.hbsService.renderFile('hello.hbs', { name: 'John Doe' });
  }

  @Get('template-string')
  fromString(): string {
    return this.hbsService.render('<h1>Hello {{name}}</h1>', {
      name: 'John Doe',
    });
  }
}
```

A runnable version of this lives in [`demo-app/`](./demo-app).

## License

MIT
