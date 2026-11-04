// Stand-in for @anthropic-ai/sdk, see route-hooks.mjs. `messages.stream(params)` and
// `messages.create(params)` hand the request to the test, which returns what to play back.
export default class Anthropic {
  constructor() {
    this.messages = {
      stream: (params) => globalThis.__routeTest.openStream(params),
      create: (params) => globalThis.__routeTest.create(params),
    };
  }
}
