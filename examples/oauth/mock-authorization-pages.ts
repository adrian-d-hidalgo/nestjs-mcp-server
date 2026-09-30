/**
 * The HTML pages of the mock authorization server: login, consent and error.
 *
 * DEMO ONLY. Minimal inline HTML with no dependencies. Every interpolated
 * value goes through {@link escapeHtml}; the pages carry a `data-page` marker
 * (`login`, `consent`, `error`) so tests can tell them apart.
 */
import { DEMO_USERS } from './demo-users';

/** What each scope lets a client do, as the consent page words it. */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'notes:read': 'Read your notes',
  'notes:write': 'Add notes on your behalf',
};

/** Escapes text for an HTML element body or a double-quoted attribute. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const STYLE = `
  body { font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b; margin: 0; }
  main { max-width: 26rem; margin: 3rem auto; background: #fff; padding: 1.5rem 2rem;
         border-radius: .5rem; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
  .demo { background: #fef3c7; color: #92400e; padding: .4rem .6rem; border-radius: .25rem;
          font-size: .8rem; margin-top: 0; }
  .error { background: #fee2e2; color: #991b1b; padding: .5rem .75rem; border-radius: .25rem; }
  label { display: block; margin: .75rem 0; }
  input { display: block; width: 100%; box-sizing: border-box; padding: .4rem; margin-top: .25rem; }
  button { padding: .5rem 1rem; margin: .75rem .5rem 0 0; cursor: pointer; }
  .hint { font-size: .8rem; color: #52525b; }
`;

const layout = (
  kind: 'login' | 'consent' | 'error',
  title: string,
  body: string,
): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body data-page="${kind}">
<main>
<p class="demo">Mock authorization server &mdash; DEMO ONLY, never use in production.</p>
<h1>${escapeHtml(title)}</h1>
${body}
</main>
</body>
</html>
`;

const hiddenRequest = (requestId: string): string =>
  `<input type="hidden" name="request" value="${escapeHtml(requestId)}">`;

/** The sign-in form. `error` re-renders it after a failed attempt. */
export const loginPage = (options: {
  requestId: string;
  clientName: string;
  error?: string;
  username?: string;
}): string => {
  const users = DEMO_USERS.map(
    (user) =>
      `<code>${escapeHtml(user.username)}</code> / <code>${escapeHtml(
        user.password,
      )}</code> (${escapeHtml(user.scopes.join(' '))})`,
  ).join('<br>');

  return layout(
    'login',
    'Sign in',
    `<p>Sign in to continue to <strong>${escapeHtml(options.clientName)}</strong>.</p>
${options.error ? `<p class="error" role="alert">${escapeHtml(options.error)}</p>` : ''}
<form method="post" action="login">
${hiddenRequest(options.requestId)}
<label>Username <input name="username" autocomplete="username" required autofocus value="${escapeHtml(options.username ?? '')}"></label>
<label>Password <input name="password" type="password" autocomplete="current-password" required></label>
<button type="submit">Sign in</button>
</form>
<p class="hint">Demo users:<br>${users}</p>`,
  );
};

/** The consent screen: who asks, for whom, and exactly what it would get. */
export const consentPage = (options: {
  requestId: string;
  clientName: string;
  username: string;
  scopes: string[];
}): string => {
  const scopes = options.scopes
    .map(
      (scope) =>
        `<li><code>${escapeHtml(scope)}</code> &mdash; ${escapeHtml(
          SCOPE_DESCRIPTIONS[scope] ?? scope,
        )}</li>`,
    )
    .join('\n');

  return layout(
    'consent',
    'Authorize access',
    `<p><strong>${escapeHtml(options.clientName)}</strong> wants to access your account.</p>
<p>Signed in as <strong>${escapeHtml(options.username)}</strong>.</p>
<p>If you allow it, it will be able to:</p>
<ul>
${scopes}
</ul>
<form method="post" action="consent">
${hiddenRequest(options.requestId)}
<button type="submit" name="decision" value="deny">Deny</button>
<button type="submit" name="decision" value="approve">Allow</button>
</form>`,
  );
};

/**
 * An error the AS must NOT redirect to the client (RFC 6749 §4.1.2.1): an
 * unknown client or redirect URI, or a stale login/consent form.
 */
export const errorPage = (error: string, description: string): string =>
  layout(
    'error',
    'Authorization error',
    `<p class="error" role="alert"><code>${escapeHtml(error)}</code>: ${escapeHtml(description)}</p>
<p>Return to the application and start again.</p>`,
  );
