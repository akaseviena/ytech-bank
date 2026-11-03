// A stand-in for the Supabase client, just enough PostgREST for the context builders.
//
// It is strict on purpose, so a test cannot pass by accident:
//   - an unknown table throws;
//   - select("a,b") returns only the columns asked for, select("*") returns everything,
//     so a query that quietly widens its column list brings the extra data into view;
//   - every query is recorded ({ table, columns }) for the test to inspect.
// Filters that matter for the shape of the result (eq, is, or, not-in, gte/lt on dates,
// order, range, limit) are applied; anything else is accepted and ignored.
//
// Writes (update, upsert, insert) change the tables and are recorded in `writes`, apart from
// the read `log`. `rpc(name, args)` calls the handler given in `options.rpc`.

export function fakeDb(tables, options = {}) {
  const log = [];
  const writes = [];

  function builder(table) {
    if (!(table in tables)) throw new Error(`fake db: no table "${table}"`);
    const q = { table, columns: null, preds: [], orders: [], from: 0, to: Infinity, write: null };
    const b = {
      select(cols) { q.columns = cols; log.push({ table, columns: cols }); return b; },
      eq(c, v) { q.preds.push((r) => r[c] === v); return b; },
      is(c, v) { q.preds.push((r) => (v === null ? r[c] == null : r[c] === v)); return b; },
      update(values) { q.write = { kind: "update", values }; return b; },
      insert(values) { q.write = { kind: "insert", values }; return b; },
      upsert(values) { q.write = { kind: "upsert", values }; return b; },
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
      then(res, rej) { return Promise.resolve(q.write ? write() : { data: rows(), error: null }).then(res, rej); },
    };
    function write() {
      const { kind, values } = q.write;
      writes.push({ table, kind, values: structuredClone(values) });
      const list = tables[table];
      if (kind === "insert" && values.id !== undefined && list.some((r) => r.id === values.id)) {
        return { data: null, error: { code: "23505", message: "duplicate key value" } };
      }
      if (kind === "insert") list.push(structuredClone(values));
      else if (kind === "upsert") {
        const i = list.findIndex((r) => r.id === values.id);
        if (i >= 0) list[i] = { ...list[i], ...structuredClone(values) };
        else list.push(structuredClone(values));
      } else {
        const hit = list.filter((row) => q.preds.every((p) => p(row)));
        for (const r of hit) Object.assign(r, structuredClone(values));
        // `update(...).select("id")` answers with the rows it changed, as PostgREST does
        if (q.columns !== null) return { data: hit.map((r) => Object.fromEntries(q.columns.split(",").map((c) => [c.trim(), r[c.trim()]]))), error: null };
      }
      return { data: null, error: null };
    }
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

  function rpc(name, args) {
    const handler = options.rpc?.[name];
    if (!handler) throw new Error(`fake db: no rpc "${name}"`);
    return Promise.resolve({ data: handler(args, tables), error: null });
  }

  return { from: builder, rpc, log, writes };
}
