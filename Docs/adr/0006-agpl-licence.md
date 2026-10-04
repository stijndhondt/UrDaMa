# Licence: AGPL-3.0-or-later

Urdama is licensed under the **GNU Affero General Public License v3.0 or later**. It is a web app, and under the plain GPL a company could modify it and run it as a closed hosted service without sharing anything, because hosting is not distributing. The AGPL closes that gap: anyone offering a modified Urdama over a network must share the source, so improvements stay open. Anyone may still use and self-host it.

## Considered Options

- **GPL-3.0:** protects distributed copies only; hosted forks could stay closed.
- **MIT / Apache-2.0:** maximum reuse, including in closed commercial products. That conflicts with keeping improvements open.

## Consequences

- Every dependency must be AGPL-3.0-compatible. All current choices are: MIT, BSD, ISC, BSL-1.0, and Apache-2.0 (Apache-2.0 is compatible with v3, not v2).
- JSTS, used only as a test reference, must be used under its EDL-1.0 option.
- A future contribution policy (DCO or CLA) is still to be decided.
