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
| `helpers`   | An array of helpers to add in handlebars, each helpers has a property `name` and  `fn`   |



# Usage


You can use the `HandlebarsService`, there is currently two methods

|            | Description                                                                                                                      | Parameters                                                                                                             |
|------------|----------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| renderFile | This will render a handlebars template (located in the template folder previously defined), and will return the rendered string. | - `file`: the template file to render <br>- `parameters`: an array of parameters that will be used inside the template |
| render     | This will render a template string using handlebars                                                                              | - `html`: the template <br>- `parameters`: an array of parameters that will be used inside the template string         |
Here is an example 
```ts
@Controller()
export class AppController {
  constructor(private readonly hbsService: HandlebarsService) {}

  @Get()
  async getTest() {
    return this.hbsService.renderFile('hello.hbs', { name: 'John Doe'});
  }
  @Get('template-string')
  async getTest() {
    return this.hbsService.render('<h1>Hello {{name}}</h1>', { name: 'John Doe'});
  }
}
```

