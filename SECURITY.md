# Security Policy

## Supported versions

Security fixes are prioritized for the latest stable desktop release published on
the [Modesto releases page](https://github.com/Syphon1205/Modesto/releases).

| Version | Supported |
| ------- | --------- |
| Latest stable release | Yes |
| Older releases | Best effort |

## Reporting a vulnerability

Please report security vulnerabilities privately. Do **not** open a public issue
for security reports.

Preferred path:

1. Open a private GitHub Security Advisory:
   <https://github.com/Syphon1205/Modesto/security/advisories/new>
2. Include enough detail to reproduce the issue, the affected version or
   commit, and any known workaround.
3. Allow a reasonable time for triage before any public disclosure.

You can also contact the maintainer privately via GitHub:
[@Syphon1205](https://github.com/Syphon1205).

## What to expect

- We will acknowledge valid reports as soon as practical.
- We will confirm the issue, assess impact, and work on a fix for the latest
  supported release when appropriate.
- We may ask follow-up questions if the report needs more detail.
- Credit will be given to reporters who want it, unless they prefer to remain
  anonymous.

## Scope guidance

In scope examples:

- Remote code execution or sandbox escapes in the desktop app or update path
- Credential, token, or secret leakage through Modesto surfaces
- Privilege escalation or unauthorized access to local project/session data
- Supply-chain issues in published Modesto release artifacts

Out of scope examples:

- Vulnerabilities only in third-party agent providers (Codex, Claude, Cursor,
  and similar) that Modesto does not control
- Issues that require an already-compromised local machine with full user
  access
- Social-engineering reports without a technical vulnerability

## Safe Harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and
  service interruption
- Report findings privately before public disclosure
- Do not exploit the issue beyond what is needed to demonstrate it
