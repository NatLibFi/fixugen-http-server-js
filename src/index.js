import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import createDebugLogger from 'debug';
import {promisify} from 'util';

export default ({path, recurse, formatResponse = formatResponseDefault, callback: createApp, hooks = {}}) => {
  const setTimeoutPromise = promisify(setTimeout); // eslint-disable-line
  const debug = createDebugLogger('@natlibfi/fixugen-http-server');
  const debugDev = createDebugLogger('@natlibfi/fixugen-http-server:dev');

  generateTests({
    path, recurse,
    callback: httpCallback,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false
    },
    hooks: {
      ...hooks
    }
  });

  async function httpCallback({getFixtures, requests, ...options}) {
    const requestFixtures = getFixtures({
      components: [/^request[0-9]+\..*$/u],
      reader: READERS.TEXT
    });

    const responseFixtures = getFixtures({
      components: [/^response[0-9]+\..*$/u],
      reader: READERS.TEXT
    });

    const server = await createApp({getFixtures, ...options, requests});
    await iterate(requests, server);
    //await setTimeoutPromise(5000);

    return;

    // eslint-disable-next-line
    async function iterate(testRequests, server, index = 0) {
      const [testRequest, ...rest] = testRequests;

      if (testRequest === undefined) {
        await server.close();
        debug('Server closed');
        return;
      }
      debug('Iteration', index);
      debugDev(testRequest);

      const {
        method, path, status,
        requestParams = {}, requestHeaders = {}, responseHeaders = {}
      } = testRequest;

      const requestPayload = requestFixtures[index];
      const requestPath = path || '/';
      const requestMethod = method.toLowerCase();
      const parsedParams = new URLSearchParams(requestParams).toString();
      const url = `http://localhost:1337${requestPath}${parsedParams === '' ? '' : '?' + parsedParams}`;
      debugDev(url);
      const response = await fetch(url, {method: requestMethod, headers: requestHeaders, body: requestPayload});

      await handleResponse(response, status, responseHeaders);
      return iterate(rest, server, index + 1);


      async function handleResponse(response, status, responseHeaders) {
        debug('Handling response');
        const {headers, payload} = await formatResponse(response);
        const expectedResponsePayload = responseFixtures[index];
        debugDev('status');
        debugDev(status);
        debugDev(response.status);
        assert.equal(response.status, status);

        debugDev('responseHeaders');
        debugDev(responseHeaders);
        //debugDev(headers);

        Object.entries(responseHeaders).forEach(([key, value]) => {
          assert.equal(headers.get(key), value);
        });

        if (expectedResponsePayload) {
          debugDev('expectedResponsePayload');
          debugDev(expectedResponsePayload);
          debugDev(payload);
          assert.equal(payload, expectedResponsePayload);
        }

        debug('Response handling done');
      }
    }
  }
};

async function formatResponseDefault(response) {
  const payload = await response.text();
  const headers = response.headers;
  return {headers, payload};
}

