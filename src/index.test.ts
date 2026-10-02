import createDebugLogger from 'debug';
import type {Server} from 'node:http';
import express from 'express';
import type {Express, Request, Response} from 'express';
import {promisify} from 'util';
import generateTests from './index.ts';
import type {HttpRequest} from './index.ts';

const setTimeoutPromise = promisify(setTimeout);
const debug = createDebugLogger('@natlibfi/fixugen-http-server:test');
const debugDev = createDebugLogger('@natlibfi/fixugen-http-server:test:dev');

function addRoute(app: Express, method: string, path: string, handler: (_req: Request, _res: Response) => void): void {
  if (method.toUpperCase() === 'GET') {
    app.get(path, handler);
    return;
  }

  if (method.toUpperCase() === 'POST') {
    app.post(path, handler);
    return;
  }

  if (method.toUpperCase() === 'PUT') {
    app.put(path, handler);
    return;
  }

  if (method.toUpperCase() === 'DELETE') {
    app.delete(path, handler);
    return;
  }

  if (method.toUpperCase() === 'PATCH') {
    app.patch(path, handler);
    return;
  }

  throw new Error(`Unsupported HTTP method: ${method}`);
}

generateTests({
  recurse: false,
  path: [import.meta.dirname, '..', 'test-fixtures'],
  callback: async ({getFixture, requests}) => {
    debug('Preparing server');
    const app: Express = express();

    return createEndpoints(requests as HttpRequest[]);

    async function createEndpoints(requests: HttpRequest[], index = 0): Promise<Server> {
      const [request, ...rest] = requests;

      if (request === undefined) {
        const server = app.listen(1337, (error) => {
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
      const {method, status = 200, path = '/', responseHeaders = {}} = request;

      const responsePayload = getFixture(`response${index}.txt`) as string | undefined;
      debugDev('responsePayload: ', responsePayload);

      if (responsePayload !== undefined) {
        debugDev('Making endpoint with responsePayload');

        addRoute(app, method, path, (_req: Request, res: Response) => {
          const payload = responsePayload;
          Object.entries(responseHeaders).forEach(([k, v]) => res.set(k, v));
          return res.status(status).send(payload);
        });

        return createEndpoints(rest, index + 1);
      }

      debugDev('Making endpoint with out responsePayload');
      addRoute(app, method, path, (_req: Request, res: Response) => {
        Object.entries(responseHeaders).forEach(([k, v]) => res.set(k, v));
        res.sendStatus(status);
      });

      return createEndpoints(rest, index + 1);
    }
  }
});
