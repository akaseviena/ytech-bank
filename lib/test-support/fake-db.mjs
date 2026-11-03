// A stand-in for the Supabase client, just enough PostgREST for the context builders.
//
// It is strict on purpose, so a test cannot pass by accident:
//   - an unknown table throws;
//   - select("a,b") returns only the columns asked for, select("*") returns everything,
//     so a query that quietly widens its column list brings the extra data into view;
//   - every query is recorded ({ table, columns }) for the test to inspect.
// Filters that matter for the shape of the result (eq, or, not-in, gte/lt on dates,
// order, range, limit) are applied; anything else is accepted and ignored.

export function fakeDb(tables) {
  const log = [];

  function builder(table) {
    if (!(table in tables)) throw new Error(`fake db: no table "${table}"`);
    const q = { table, columns: null, preds: [], orders: [], from: 0, to: Infinity };
    const b = {
      select(cols) { q.columns = cols; log.push({ table, columns: cols }); return b; },
      eq(c, v) { q.preds.push((r) => r[c] === v); return b; },
      neq(c, v) { q.preds.push((r) => r[c] !== v); return b; },
      in(c, vs) { q.preds.push((r) => vs.includes(r[c])); return b; },
      not(c, op, v) {
        if (op === "in") {
          const list = String(v).replace(/^\(|\)$/g, "").split(",");
          q.preds.push((r) => !list.includes(r[c]));
        }
        return b;
      },
      gte(c, v) { q.preds.push((r) => Date.parse(r[c]) >= Date.parse(v)); return b; },
      lt(c, v) { q.preds.push((r) => Date.parse(r[c]) < Date.parse(v)); return b; },
      or(expr) {
        const clauses = String(expr).split(",").map((p) => p.split("."));
        q.preds.push((r) => clauses.some(([c, op, v]) => op === "eq" && String(r[c]) === v));
        return b;
      },
      order(c, o = {}) { q.orders.push({ c, asc: o.ascending !== false }); return b; },
      range(a, z) { q.from = a; q.to = z + 1; return b; },
      limit(n) { q.to = q.from + n; return b; },
      maybeSingle() { return Promise.resolve(single()); },
      single() { return Promise.resolve(single()); },
      then(res, rej) { return Promise.resolve({ data: rows(), error: null }).then(res, rej); },
    };
    function rows() {
      let out = tables[table].filter((r) => q.preds.every((p) => p(r)));
      for (const { c, asc } of [...q.orders].reverse()) {
        out = [...out].sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0) * (asc ? 1 : -1));
      }
      out = out.slice(q.from, q.to);
      if (q.columns === null || q.columns === "*") return out.map((r) => ({ ...r }));
      const want = q.columns.split(",").map((s) => s.trim());
      return out.map((r) => Object.fromEntries(want.map((c) => [c, r[c]])));
    }
    function single() {
      const [first] = rows();
      return { data: first ?? null, error: null };
    }
    return b;
  }

  return { from: builder, log };
}
