import express from 'express';
import generateTests from '.';

generateTests({
  recurse: false,
  path: [__dirname, '..', 'test-fixtures'],
  callback: ({getFixture, requests}) => {
    const app = express();
    return iterate(requests);

    function iterate(requests, index = 0) {
      const [request] = requests;

      if (request) {
        const {method, path, status, responseHeaders = {}} = request;
        const responsePayload = getFixture(`response${index}.txt`) || '';

        app[method](path || '/', (req, res) => {
          Object.entries(responseHeaders).forEach(([k, v]) => res.set(k, v));

          if (responsePayload) {
            return res.status(status).send(responsePayload);
          }

          res.sendStatus(status);
        });

        return iterate(requests.slice(1), index + 1);
      }

      return app.listen(1337);
    }
  }
});
