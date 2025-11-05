import createDebugLogger from 'debug';
import express from 'express';
import {promisify} from 'util';
import generateTests from './index.js';

const setTimeoutPromise = promisify(setTimeout); // eslint-disable-line
const debug = createDebugLogger('@natlibfi/fixugen-http-server:test');
const debugDev = createDebugLogger('@natlibfi/fixugen-http-server:test:dev');

generateTests({
  recurse: false,
  path: [import.meta.dirname, '..', 'test-fixtures'],
  callback: ({getFixture, requests}) => {
    debug('Preparing server');
    const app = express();

    return createEndpoints(requests);

    async function createEndpoints(requests, index = 0) {
      const [request, ...rest] = requests;

      if (request === undefined) {
        const server = app.listen(1337, undefined, (error) => {
          if (error) {
            debugDev(error);
            throw error;
          }
          debug('Server is listening!');
        });

        await setTimeoutPromise(5);
        return server;
      }
      debug('creating express endpoint: ', index);
      debugDev('request: ', request);
      const {method, status, path = '/', responseHeaders = {}} = request;

      const responsePayload = getFixture(`response${index}.txt`);
      debugDev('responsePayload: ', responsePayload);

      if (responsePayload) {
        debugDev('Making endpoint with responsePayload');

        app[method](path, (req, res) => {
          const payload = responsePayload;
          Object.entries(responseHeaders).forEach(([k, v]) => res.set(k, v));
          return res.status(status).send(payload);
        });

        return createEndpoints(rest, index + 1);
      }

      debugDev('Making endpoint with out responsePayload');
      app[method](path, (req, res) => {
        Object.entries(responseHeaders).forEach(([k, v]) => res.set(k, v));
        res.sendStatus(status);
      });

      return createEndpoints(rest, index + 1);
    }
  }
});
