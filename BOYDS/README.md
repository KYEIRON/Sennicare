# BOYD'S Logistics LLC — Operating System

Software that runs **BOYD'S Logistics LLC**, a logistics company operating in
North Carolina, USA.

> **BOYD'S is an independent company and an independent software project.**
> This repository also contains an unrelated project, Sennicare, in `/website`.
> They share a repository for organisational convenience only. They share no
> code, no data, no dependencies, and no business logic.

---

## The point of this software

BOYD'S optimises for **profitable work, not revenue**.

The system exists to answer one question honestly, job by job: _did this make
money?_ Revenue is never presented as profit. Costs are never hidden. When a cost
is missing, the system says `DATA INCOMPLETE` instead of guessing.

---

## Where things are

| Path                   | What it is                                                |
| ---------------------- | --------------------------------------------------------- |
| `CLAUDE.md`            | Project rules — **read first**                            |
| `docs/`                | The full specification, architecture, and plans           |
| `src/app/(site)`       | Public marketing website                                  |
| `src/app/(ops)`        | Partner operations OS and Command Centre                  |
| `src/app/(driver)`     | Moh's mobile driver application                           |
| `src/services/`        | The domain — profitability engine, pricing, state machine |
| `src/database/`        | Repositories — the only place database queries live       |
| `supabase/migrations/` | Database schema                                           |
| `tests/`               | Unit, integration, and end-to-end tests                   |

## Documentation

| Document                                                 | What it covers                                      |
| -------------------------------------------------------- | --------------------------------------------------- |
| [BUSINESS_SPECIFICATION](docs/BUSINESS_SPECIFICATION.md) | The company, the rules, the open business decisions |
| [ARCHITECTURE](docs/ARCHITECTURE.md)                     | How the system is built and why                     |
| [DATABASE](docs/DATABASE.md)                             | Every table, every enum, RLS, the state machine     |
| [BUSINESS_RULES](docs/BUSINESS_RULES.md)                 | The 43 rules the software enforces                  |
| [FINANCIAL_ENGINE](docs/FINANCIAL_ENGINE.md)             | The money maths, exactly                            |
| [DRIVER_APP](docs/DRIVER_APP.md)                         | Moh's application                                   |
| [CRM](docs/CRM.md)                                       | Leads, pipeline, quotes                             |
| [WEBSITE](docs/WEBSITE.md)                               | Public site and SEO                                 |
| [AI](docs/AI.md)                                         | BOYD'S AI, both surfaces, and the 2 AM scenario     |
| [SECURITY](docs/SECURITY.md)                             | Auth, permissions, the driver and public boundaries |
| [TESTING](docs/TESTING.md)                               | What is tested and how                              |
| [INTEGRATIONS](docs/INTEGRATIONS.md)                     | Maps, email, SMS, AI, storage, payments             |
| [DECISIONS](docs/DECISIONS.md)                           | Architectural decision log                          |
| [ROADMAP](docs/ROADMAP.md)                               | The 15 phases                                       |

---

## Business locale

USD · miles · gallons · `America/New_York` · United States.
North Carolina is the initial market and is stored as **data**, never hardcoded,
so expansion costs a database row rather than a release.

---

## Status

**Phase 8 complete** — CRM, quoting and the pricing engine are built and verified.

| Gate             | Result                      |
| ---------------- | --------------------------- |
| Unit tests       | 85 passed, 0 failed         |
| Type check       | passing (TypeScript strict) |
| Lint             | passing                     |
| Production build | passing                     |
| `npm audit`      | 0 vulnerabilities           |

Phase 9 (invoices and contracts) is next.
See [ROADMAP](docs/ROADMAP.md).

## Running it

```bash
npm install
npm run dev       # development server
npm run verify    # the full gate: format, lint, types, tests, build

# Row level security is tested against a real database, never mocked:
npm run db:start  # start local PostgreSQL
npm run test:db   # apply migrations, then run the security tests
```
