import assert from 'node:assert';
import type {Server} from 'node:http';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import type {CallbackArgs} from '@natlibfi/fixugen';
import createDebugLogger from 'debug';
import type {Headers, Response} from 'undici-types';

export type HttpHeaders = Record<string, string>;

export interface HttpRequest {
  method: string;
  path?: string;
  status?: number;
  requestParams?: HttpHeaders;
  requestHeaders?: HttpHeaders;
  responseHeaders?: HttpHeaders;
}

export interface FormatResponseResult {
  headers: Headers;
  payload: string;
}

export type FormatResponse = (_response: Response) => Promise<FormatResponseResult>;

export type CreateApp = (_args: CallbackArgs & {requests: HttpRequest[]}) => Promise<Server>;

export interface HttpServerOpts {
  path: string[];
  recurse?: boolean;
  hooks?: {
    before?: () => void;
    beforeEach?: () => void;
    after?: () => void;
    afterEach?: () => void;
  };
  formatResponse?: FormatResponse;
  callback: CreateApp;
}

const REQUEST_FILTER = /^request[0-9]+\..*$/u;
const RESPONSE_FILTER = /^response[0-9]+\..*$/u;
const SERVER_URL = 'http://localhost:1337';

async function formatResponseDefault(response: Response): Promise<FormatResponseResult> {
  const payload = await response.text();
  const {headers} = response;
  return {headers, payload};
}

export default ({path, recurse, formatResponse = formatResponseDefault, callback: createApp, hooks = {}}: HttpServerOpts) => {
  const debug = createDebugLogger('@natlibfi/fixugen-http-server');
  const debugDev = createDebugLogger('@natlibfi/fixugen-http-server:dev');

  generateTests({
    path, recurse,
    callback: httpCallback,
    useMetadataFile: true,
    fixura: {
      reader: READERS.TEXT,
      failWhenNotFound: false
    },
    hooks: {
      ...hooks
    }
  });

  async function httpCallback({getFixtures, requests, ...options}: CallbackArgs): Promise<void> {
    // Note: default reader of the fixture factory (set via fixura opts) is READERS.TEXT
    // fixura getFixtures returns an untyped array; cast at the trust boundary (upstream fixura limitation)
    const requestFixtures = getFixtures(REQUEST_FILTER) as (string | undefined)[];
    const responseFixtures = getFixtures(RESPONSE_FILTER) as (string | undefined)[];
    // Metadata JSON `requests` is untyped by fixugen (CallbackArgs intersects Record<string, unknown>);
    // single cast at the trust boundary.
    const testRequests = requests as HttpRequest[];
    const server = await createApp({getFixtures, requests: testRequests, ...options});
    await iterate(testRequests, server);

    async function iterate(testRequests: HttpRequest[], server: Server, index = 0): Promise<void> {
      const [testRequest, ...rest] = testRequests;

      if (testRequest === undefined) {
        await server.close();
        debug('Server closed');
        return;
      }
      debug('Iteration', index);
      debugDev(testRequest);

      const {
        method, path: requestPath = '/', status,
        requestParams = {}, requestHeaders = {}, responseHeaders = {}
      } = testRequest;

      const requestPayload = requestFixtures[index];
      const requestMethod = method.toLowerCase();
      const parsedParams = new URLSearchParams(requestParams).toString();
      const url = `${SERVER_URL}${requestPath}${parsedParams === '' ? '' : '?' + parsedParams}`;
      debugDev(url);
      const response = await fetch(url, {method: requestMethod, headers: requestHeaders, body: requestPayload});
      await handleResponse(response, status, responseHeaders, index);
      return iterate(rest, server, index + 1);

      async function handleResponse(response: Response, status: number | undefined, responseHeaders: HttpHeaders, index: number): Promise<void> {
        debug('Handling response');
        // Note: formatResponse requires response itself as input
        const {headers, payload} = await formatResponse(response);
        const expectedResponsePayload = responseFixtures[index];
        debugDev(`status: ${status} vs response.status: ${response.status}`);
        assert.equal(response.status, status);
        debugDev(`Status OK`);
        debugDev('responseHeaders');
        debugDev(responseHeaders);
        debugDev(headers);
        Object.entries(responseHeaders).forEach(([key, value]) => {
          assert.equal(headers.get(key), value);
        });
        debugDev(`Headers OK`);

        if (expectedResponsePayload !== undefined) {
          debugDev('expectedResponsePayload');
          debugDev(expectedResponsePayload);
          debugDev('actual payload');
          debugDev(payload);
          assert.equal(payload, expectedResponsePayload);
        }

        debug('Response handling done');
      }
    }
  }
};
