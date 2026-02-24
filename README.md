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

## Database & Prisma (Supabase)

This project uses Supabase Postgres with Prisma.

### Local environment

- Create a `.env.local` file (it is gitignored via `.env*`).
- Add your Prisma connection string, matching the `POSTGRES_PRISMA_URL` value from Vercel/Supabase:

```bash
POSTGRES_PRISMA_URL="postgresql://USER:PASSWORD@HOST:PORT/dbname?sslmode=require"
```

> Do **not** commit `.env.local` or any secrets to git.

### Prisma commands

- Run migrations locally:

```bash
npm run db:migrate -- --name init
```

- Open Prisma Studio:

```bash
npm run db:studio
```

- Regenerate the Prisma Client (if the schema changes):

```bash
npm run db:generate
```
