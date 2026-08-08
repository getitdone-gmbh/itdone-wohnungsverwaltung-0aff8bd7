import { Issuer, generators } from 'openid-client';

let client = null;

export async function initAuth() {
  const issuer = await Issuer.discover(process.env.OIDC_ISSUER);
  client = new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID,
    redirect_uris: ['*'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });
  return client;
}

function redirectUri(req) {
  return `${req.protocol}://${req.get('host')}/auth/callback`;
}

export function loginHandler(req, res) {
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);
  const state = generators.state();
  req.session.oidc = { code_verifier, state };
  const url = client.authorizationUrl({
    scope: 'openid profile email',
    redirect_uri: redirectUri(req),
    code_challenge,
    code_challenge_method: 'S256',
    state,
  });
  res.redirect(url);
}

export async function callbackHandler(req, res) {
  try {
    const { code_verifier, state } = req.session.oidc || {};
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(redirectUri(req), params, {
      code_verifier,
      state,
    });
    const claims = tokenSet.claims();
    req.session.user = {
      name: claims.preferred_username || claims.name || claims.email || 'Nutzer',
      email: claims.email,
    };
    req.session.id_token = tokenSet.id_token;
    delete req.session.oidc;
    res.redirect('/');
  } catch (err) {
    console.error('OIDC callback error', err);
    res.status(500).send('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
  }
}

export function logoutHandler(req, res) {
  const idToken = req.session.id_token;
  const issuerMeta = client.issuer.metadata;
  req.session.destroy(() => {
    if (issuerMeta.end_session_endpoint) {
      const postLogout = `${req.protocol}://${req.get('host')}/`;
      const url = `${issuerMeta.end_session_endpoint}?post_logout_redirect_uri=${encodeURIComponent(postLogout)}${idToken ? `&id_token_hint=${idToken}` : ''}`;
      return res.redirect(url);
    }
    res.redirect('/');
  });
}

export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/auth/login');
}
