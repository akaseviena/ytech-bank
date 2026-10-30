// fetch for Supabase clients that run on the server.
//
// Next.js patches the global fetch and, in route handlers, stores the responses
// in its Data Cache — keyed by URL and headers, kept across requests (on disk in
// dev, shared across deployments on Vercel) until something revalidates them.
// A route marked `force-dynamic` does not change that for these calls. For a
// Supabase client that is wrong in two ways:
//   - reads of live data come back stale (a conversation deleted a minute ago is
//     still listed; an old balance or plan is served again);
//   - the token check (/auth/v1/user) is cached too, so a token that has expired
//     or was signed out keeps being accepted.
// `cache: "no-store"` takes these calls out of the Data Cache altogether.
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });
