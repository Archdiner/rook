This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Phase 1 Internal API Endpoints

These endpoints support the current Phase 1 orchestration flow without external integrations.

- `POST /api/phase1/sufficiency`
  - Input shape:
    - `evidence: { sessions: number; events: number; conversions: number; observedAt?: string }`
  - Returns sufficiency snapshot from `evaluateAllCategories`.

- `POST /api/phase1/insights`
  - Input shape:
    - `siteId: string`
    - `totals: { sessions: number }`
    - `cohorts: CohortAggregate[]`
    - `narratives: NarrativePathAggregate[]`
    - `onboarding: OnboardingStepAggregate[]`
    - `ctas: CtaAggregate[]`
    - `deadEnds: DeadEndAggregate[]`
    - `generatedAt?: string` (ISO date)
    - `maxFindings?: number` (positive integer)
  - Returns generated findings, truncated to the requested/top N.

- `GET /api/phase1/health`
  - Returns module availability status and capabilities.

Example payloads:

```json
{
  "evidence": {
    "sessions": 140,
    "events": 420,
    "conversions": 14,
    "observedAt": "2026-04-28T19:20:00.000Z"
  }
}
```

```json
{
  "siteId": "site_123",
  "maxFindings": 3,
  "totals": { "sessions": 1200 },
  "cohorts": [],
  "narratives": [],
  "onboarding": [],
  "ctas": [],
  "deadEnds": []
}
```
