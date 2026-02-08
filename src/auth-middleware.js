const cookie = require("cookie");

/**
 * @param {import("pg").Pool} pgPool
 * @param {object} opts
 * @param {string} opts.cookieName
 * @param {boolean} opts.signed  Se true, ci si aspetta cookie "s:<value>.<sig>" (cookie-parser)
 * @param {string} [opts.cookieParserSecret] Necessario se signed=true e vuoi verificare signature lato service.
 *                                            (Opzionale: molti servizi non verificano la firma e si fidano del gateway)
 */
function makeAuthMiddleware(pgPool, opts = {}) {
  const cookieName = opts.cookieName || "eucleth_sid";
  const signed = Boolean(opts.signed);

  return async function auth(req, res, next) {
    try {
      const cookies = cookie.parse(req.headers.cookie || "");
      let sid = cookies[cookieName];

      if (!sid) {
        req.user = null;
        return next();
      }

      // Se il gateway usa cookie-parser signed cookies, il cookie in chiaro verso nginx/servizi è tipo:
      // eucleth_sid=s%3A<sid>.<sig>  (URL-encoded)
      // Qui gestiamo "s:<sid>.<sig>" senza validare la firma (validation opzionale).
      // Decodifica urlencoding:
      sid = decodeURIComponent(sid);

      if (signed) {
        if (sid.startsWith("s:")) sid = sid.slice(2);
        // sid ora è "<sid>.<sig>" -> prendiamo la parte prima del punto
        const dot = sid.lastIndexOf(".");
        if (dot > 0) sid = sid.slice(0, dot);
      }

      const r = await pgPool.query(
        `SELECT u.id, u.username, u.email_verified, s.expires_at
         FROM auth.sessions s
         JOIN auth.users u ON u.id = s.user_id
         WHERE s.sid = $1`,
        [sid]
      );

      const row = r.rows[0];
      if (!row) {
        req.user = null;
        return next();
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        await pgPool.query(`DELETE FROM auth.sessions WHERE sid=$1`, [sid]);
        req.user = null;
        return next();
      }

      req.user = {
        id: row.id,
        username: row.username,
        email_verified: row.email_verified
      };
      next();
    } catch (e) {
      req.user = null;
      next();
    }
  };
}

module.exports = { makeAuthMiddleware };
