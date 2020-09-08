# Generate unit tests for HTTP servers with fixugen

Generates unit tests with fixugen and [chai-http](). Starts a HTTP server which is tested with generic HTTP request and response expectations.

Uses [fixugen's](https://www.npmjs.com/package/@natlibfi/fixugen) **useMetadataFile** so your fixture directories must contain **metadata.json** file.

# Usage
```js
import generateTests from '@natlibfi/fixugen-http-server';
import startApp from './app';

generateTests({
  callback: () => startApp(),
  path: [__dirname, '..', '..', 'test-fixtures', 'app']
});

```
# Configuration
An array property **requests** must be present in **metadata.json** file. It supports the following properties:
- **status**: HTTP status code (Number). **Mandatory**.
- **method**: HTTP method in lowercase. **Mandatory**.
- **path**: URL path. Defaults to `/`
- **requestHeaders**: An object representing requests headers.
- **responseHeaders**: An object representing response headers.

This configuration is also passed to the callback as the property **requests**.

# Request and response payloads
The fixture directory for each unit test can have request- and response payload fixtures which must match the following filename pattern:
`/^request[0-9]+`
`/^response[0-9]+`

# Formatting the response
Pass a callback to the exported function to format response headers and payload:
```js
generateTests({
  formatResponse,
  callback: () => startApp(),
  path: [__dirname, '..', '..', 'test-fixtures', 'app']
});

function formatResponse(headers, payload) {
  const newHeaders = doSomethingWithHeaders();
  return { payload, headers: newHeaders };
}
```

Where `[0-9]+` denotes the index number of the fixture (Requests and responses are mocked in that order).

## License and copyright

Copyright (c) 2020 **University Of Helsinki (The National Library Of Finland)**

This project's source code is licensed under the terms of **GNU Lesser General Public License Version 3** or any later version.