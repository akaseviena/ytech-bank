// Stand-in for next/server, see route-hooks.mjs: the two names a route handler uses.
export const NextRequest = Request;
export const NextResponse = {
  json: (body, init) => Response.json(body, init),
};
