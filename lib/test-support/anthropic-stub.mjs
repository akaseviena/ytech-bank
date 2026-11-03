// Stand-in for @anthropic-ai/sdk, see route-hooks.mjs. `messages.stream(params)` hands the
// request to the test, which returns the stream to play back.
export default class Anthropic {
  constructor() {
    this.messages = { stream: (params) => globalThis.__routeTest.openStream(params) };
  }
}
