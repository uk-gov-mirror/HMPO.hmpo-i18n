# hmpo-i18n

A lightweight internationalization (i18n) library and middleware for Node.js and Express applications, built to support
HM Passport Office (HMPO) services. It draws inspiration from concepts found in [i18next](https://www.i18next.com/).

---

## Features

### Translation Management

- **Flexible Translation Storage**: Simple key/value pairs in structured JSON/Yaml files
- **Nested keys**: Organize translations hierarchically (e.g., `"buttons.submit": "Submit"`)

### Locale Handling

- **Automatic detection**: Supports multiple lookup sources:
    - 🍪 Cookies
    - 🔗 Query parameters
    - 🌐 HTTP headers (`Accept-Language`)
- **Express middleware**: Zero-config integration for route handling
- **Multi-source loading**: Load translations from project directories and `node_modules`

## Installation

```
npm install hmpo-i18n
```

or

```
yarn add hmpo-i18n
```

## Basic Setup

---

#### 📁 Folder Structure

First create some resource files. These should be json or yaml files and the location of the file within your project
will define the language it corresponds to.

```
your-project/
├── app.js
├── views/
│   └── index.html
└── locales/
    ├── en/
    │   └── default.json
    │   └── validation.yaml
    └── cy/
        └── default.json
```

If you wish to create additional namespaces within your project, then create additional files within a language
directory with names corresponding to the namespace. For details on how to configure resource paths
see ["Resource path" documentation below](#resource-path)
These namespaces are superimposed onto the default layout.

### Create translation files

E.g. locales/en/default.json

```json
{
  "welcome": {
    "title": "Welcome to Our Service",
    "message": "This is a random message"
  },
  "errors": {
    "notFound": "Page not found",
    "serverError": "Something went wrong"
  }
}
```

## Usage

---

### As an express middleware:

```javascript
var app = require('express')();

var i18n = require('hmpo-i18n');

i18n.middleware(app);

app.use(function (req, res, next) {

    // load language from querystring parameter - e.g. ?lang=en
    req.setLanguage(req.query.lang);

    // a translate method is now available on the request
    // this will translate keys according to the language request headers
    res.render('index', {
        title: req.translate('title')
    });
});

app.listen(3000);
...
```

### Using Custom Language Detection with Express Middleware:

Middleware can detect the language from the Accepts header by if the detect option is true. A custom language can be set
using req.setLanguage(lang).

### Provided Examples

[Cookies example](./examples/express_with_cookies_and_view):
This cookie example shows hmpo-i18n persisting language preference via HTTP cookies within an Express application,
typically using a templating engine (like Nunjucks) to display content.
It employs the cookie-parser middleware and configures hmpo-i18n to prioritize reading a designated language cookie (
e.g., 'lang') when determining the language for rendered pages.
When a language is explicitly chosen or determined by other means, the middleware is also configured to set this
preference as a cookie in the response.
This allows the application to remember the user's choice and display pages in the correct language across subsequent
visits.

### Practical Integration Example: hmpo-i18n within hmpo-app

[Usage in hmpo-app](https://github.com/HMPO/hmpo-app/blob/0727b78b453f933e28f20368b0dd5550d5139060/middleware/translation.js#L27):
In hmpo-app, hmpo-i18n is used to manage application translations by first applying its core middleware to handle
language detection and provide a request-specific translation function (translate).
Custom application middleware, like the translation.js file, then makes this function accessible to the view rendering
layer.
This allows developers building pages within hmpo-app to easily embed translated text directly into their HTML templates
using a simple translate('translation.key') syntax.

--- 

## Configuration Options

| Option              | Description                                                                                                           |
|---------------------|-----------------------------------------------------------------------------------------------------------------------|
| `baseDir`           | Root directory for resource lookup based on path. Default: process.cwd().                                             
| `allowedLangs`      | List of allowed languages                                                                                             
| `cookie`            | Cookie settings (e.g., `{ name: 'lang' }`)                                                                            
| `query`             | Name of query parameter                                                                                               
| `watch`             | Watch for resource file changes                                                                                       
| `fallbackLang`      | Sets the fallback language if none is specified or a key is missing. Default: 'en'.                                   
| `fallbackNamespace` | Sets the fallback namespace if unspecified or key is missing. Default: 'default'.                                     
| `path`              | For the fs loader, sets the resource file path and pattern. Default: `locales/__lng__/__ns__.__ext__`                 
| `backend`           | Sets a custom backend (must have load method) for non-fs loading. Default: [fs resource loader](./lib/backends/fs.js) 

## Using Configuration Options

---

### Pre-defined resources

You can manually define resource sets at initialisation by passing in an object with the `resources` parameter of the
options. This is useful when you have shared translations that are used across a number of modules, so you may wish to
load from npm modules or similar - Default: `{}`

```javascript
i18n({
    resources: {
      en: require('shared-translations').en,
      fr: require('shared-translations').fr
    }
});
```

### Using Cookies for Language Detection with Express Middleware

Once the [example](./examples/express_with_cookies_and_view) is running, open your browser's developer tools (Inspect),
navigate to the Cookies section, and add a new cookie with the key `Lang` and the value `"en"` or `"cy"`.

### Fallback language:

Set the language which is used as the fallback when none is specified, or the requested key does not exist in the
requested language - Default: `'en'`

```javascript
i18n({
    fallbackLang: 'en-GB'
});
```

You can see this in action using the provided [example](./examples/express_with_cookies_and_view), open your browser's
developer tools (Inspect), go to the Cookies section, and add a new cookie with the key `Lang` and the value `"fr"`.
Since there's no fr folder in the `locales` directory, the app falls back to Welsh, as defined by the fallback setting:
`fallbackLang: ["cy"]`.

### Fallback namespace:

Set the namespace which is used as the fallback when none is specified, or the requested key does not exist in the
requested namespace - Default: `'default'`

```javascript
i18n({
    fallbackNamespace: 'admin'
});
```

If required, both the `fallbackLang` and `fallbackNamespace` options can be passed as an array.

### Resource path

For the fs resource loader (currently the only backend supported), sets the location to load resource files from, and
pattern for parsing namespace and language from the file path

```javascript
i18n({
    path: '/var/i18n/__lng__/__ns__/resource.__ext__'
});
```

### Base directory

The root directory in which to look for resources on the path defined - Default: process.cwd()

```javascript
i18n({
    baseDir: __dirname
});
```

Note: if you are using hmpo-i18n inside a module which is likely to be installed as a child dependency of another
project then it is highly recommended that you set this property.

### Custom Backend Implementation Example

Allows setting a custom backend for non-fs resource loading. Backend must export a load method, which will be called
with options object and a callback.

```javascript
i18n({
    backend: {
        load: function (options, callback) {
            // do custom resource loading
            callback(null, resources);
        }
    }
});
```

Resources returned by the callback will be an object of the following form:

```json
{
{
  en: {
    ...
    translation
    keys
    for
    default
    namespace
    ...
    'other-namespace': {
      ...
      translation
      keys
      for
      afternative
      namespace...
    }
  },
  fr: {
    ...
  },
  de: {
    ...
  }
}
```

### Single and Multi-Language Support Example

If multiple languages are passed, then the first matching language will be used. For example: i18n.translate('
greeting', ['en-GB', 'en']); will look for en-GB first, and fall back to en only if a translation for en-GB is not
found.

If the options are set to an array or a string, then this will be used as the language.

```javascript

// simple language option
i18n.translate('greeting', 'fr');
// multiple langauge options as an array
i18n.translate('greeting', ['en-GB', 'en']);

```

