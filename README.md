# Installation

```shell
npm install @gboutte/nestjs-hbs
```

# Configuration

```ts
@Module({
  imports: [
    HandlebarsModule.forRoot({
      templateDirectory: 'templates',
      compileOptions: {},
      templateOptions: {},
    })
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```
|                   | Description                                                                                                                            |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `templateDirectory` | This will define the folder where the templates files are located                                                                      |
| `compileOptions`    | The templates options can be found on: https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access |
| `templateOptions`   | The compile options can be found on https://handlebarsjs.com/api-reference/compilation.html#handlebars-compile-template-options        |



# Usage


You can use the `HandlebarsService`, there is currently two methods

|            | Description                                                                                                                      | Parameters                                                                                                          |
|------------|----------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| renderFile | This will render a handlebars template (located in the template folder previously defined), and will return the rendered string. | - `file`: the template file to render <br>- `parameters`: an array of parameters that will be user inside the template  |
| render     | This will render a template string using handlebars                                                                              | - `html`: the template <br>- `parameters`: an array of parameters that will be user inside the templatestring                                                                                       |
Here is an example 
```ts
@Controller()
export class AppController {
  constructor(private readonly hbsService: HandlebarsService) {}

  @Get()
  async getTest() {
    return this.hbs.renderFile('hello.hbs', { name: 'John Doe'});
  }
}
```

