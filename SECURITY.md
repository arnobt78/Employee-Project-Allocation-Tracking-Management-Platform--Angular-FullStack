# Security Policy

## Supported versions

Security fixes are applied to the latest code on the default branch of this repository (the live demo deployment).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report privately by email:

- **Email:** [contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)
- **Subject (suggested):** `Security: EmpowerHub / employee-management`

Include as much detail as you can:

- Description of the issue and impact
- Steps to reproduce
- Affected URL, API action, or file path (if known)
- Whether you have a suggested fix

You should receive an acknowledgement within a few business days. Please allow reasonable time for investigation and remediation before any public disclosure.

## Demo / learning deployment notes

This project is a **portfolio and learning demo**. It uses a seeded demo admin account for sign-in. Treat demo credentials and any sample data as **non-production**. Do not store real personal data or production secrets in a public fork without rotating keys and hardening auth.

Tracked seed files under `dataset/` must use **synthetic** emails, phones, and names only (`@example.com` preferred). Domain wipe/reseed scripts (`db:wipe:local`, `db:reseed:local`) require `ALLOW_DB_WIPE=1` and refuse non-localhost `DATABASE_URL` unless an explicit override is set—never enable those overrides against production.

Optional integrations (AI keys, CMS tokens, email SMTP/Resend, Sentry auth tokens) must stay **server-side** (see `.env.example`). Never commit real `.env` files or put secrets under `NG_APP_*` prefixes.

## Contact

- Portfolio: [https://www.arnobmahmud.com](https://www.arnobmahmud.com)
- Security / private reports: [contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)
