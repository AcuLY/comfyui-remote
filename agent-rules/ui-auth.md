# UI Auth For Local Verification

When UI verification redirects to `/login` or otherwise needs an authenticated session, read the login token from the project-root `.env` file and use it to log in.

Do not hard-code the token, print it in logs, or commit token values.
