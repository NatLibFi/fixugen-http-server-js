/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Generate unit tests for HTTP servers with fixugen
*
* Copyright (C) 2020 University Of Helsinki (The National Library Of Finland)
*
* This file is part of fixugen-http-server-js
*
* fixugen-http-server-js program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* fixugen-http-server-js is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

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
