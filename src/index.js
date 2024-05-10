import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';
import chai, {expect} from 'chai';
import chaiHttp from 'chai-http';

export default ({path, recurse, formatResponse = formatResponseDefault, callback: createApp, mocha = {}}) => {
  let requester; // eslint-disable-line functional/no-let

  chai.use(chaiHttp);

  generateTests({
    path, recurse,
    callback: httpCallback,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: false
    },
    mocha: {
      ...mocha,
      afterEach: mochaAfterEach
    }
  });

  async function mochaAfterEach() {
    if (mocha.afterEach) {
      await mocha.afterEach();
      return closeRequester();
    }

    closeRequester();

    function closeRequester() {
      /* istanbul ignore else: Not easily tested */
      if (requester) {
        return requester.close();
      }
    }
  }

  async function httpCallback({getFixtures, requests, ...options}) {
    const requestFixtures = getFixtures({
      components: [/^request[0-9]+\..*$/u],
      reader: READERS.TEXT
    });

    const responseFixtures = getFixtures({
      components: [/^response[0-9]+\..*$/u],
      reader: READERS.TEXT
    });

    const app = await createApp({...options, requests});

    requester = chai.request(app).keepOpen();

    return iterate(requests);

    async function iterate(testRequests, index = 0) {
      const [testRequest] = testRequests.slice(0, 1);

      if (testRequest) {
        const {
          method, path, status,
          requestParams = {}, requestHeaders = {}, responseHeaders = {}
        } = testRequest;

        const requestPayload = requestFixtures[index];
        const requestPath = path || '/';
        const requestMethod = method.toLowerCase();
        const request = requester[requestMethod](requestPath).buffer(true);

        request.query(requestParams);

        Object.entries(requestHeaders).forEach(([k, v]) => request.set(k, v));

        const response = await request.send(requestPayload);
        await handleResponse(response, status, responseHeaders);
        return iterate(requests.slice(1), index + 1);

      }

      async function handleResponse(response, status, responseHeaders) {
        const {headers, payload} = await formatResponse(responseHeaders, response.text);
        const expectedResponsePayload = responseFixtures[index];

        expect(response).to.have.status(status);

        Object.entries(headers).forEach(([key, value]) => expect(response).to.have.header(key, value));

        if (expectedResponsePayload) {
          return expect(payload).to.equal(expectedResponsePayload);
        }
      }
    }
  }
};

function formatResponseDefault(headers, payload) {
  return {headers, payload};
}
