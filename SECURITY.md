# Security policy

## Supported versions

Security fixes are made on the default branch and included in the next release.
Only the latest published version is supported; older releases should be
upgraded rather than patched in place.

## Reporting a vulnerability

Report vulnerabilities privately through the repository's
[security advisory form](https://github.com/southleft/ds-contracts-poc/security/advisories/new).
Do not include exploit details, credentials, or other sensitive material in a
public issue.

If private vulnerability reporting is unavailable, open a public issue that
contains no vulnerability details and asks `@southleft` for a private reporting
channel. The repository owner will acknowledge a report as soon as practical,
coordinate validation and remediation privately, and credit reporters who want
to be named.

Useful reports include:

- the affected package, command, or workflow and version or commit;
- minimal reproduction steps and the expected security boundary;
- impact, prerequisites, and whether exploitation has been observed;
- any suggested mitigation, without publishing a working exploit.

Please allow time for a fix and coordinated disclosure before publishing the
report. Never include real secrets in a reproduction; use clearly fake test
values.

## Release and deployment controls

CI may build, audit, and compare release artifacts, but it does not publish npm
packages or deploy sites. Publishing and deployment remain explicit,
human-approved operations with the repository owner's credentials and any
required one-time password.
