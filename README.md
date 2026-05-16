# Y-tech Bank MVP

A premium digital banking application built with Next.js 14, Supabase, and AI-powered insights via Claude.

## What is Y-tech Bank?

Y-tech Bank is a full-featured banking MVP showcasing:
- **Real-time balance** with animated UI
- **Peer-to-peer transfers** via Supabase RPC
- **AI financial assistant** powered by Claude (claude-sonnet-4-20250514)
- **Analytics** with Recharts charts (donut + area charts)
- **Virtual card** with freeze/unfreeze, reveal controls
- **Savings goals** with progress bars
- **Premium liquid-glass UI** with gold accents and Framer Motion animations

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up the database

1. Go to [supabase.com](https://supabase.com) → Your project → SQL Editor
2. Paste the full contents of `supabase/schema.sql`
3. Click **Run**

### 4. Add your logo

Copy your logo file to `public/logo.png` (PNG, recommended 512×512px, transparent background).

### 5. Run the development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## How to get API keys

### Supabase
1. Go to [supabase.com](https://supabase.com) and create a project
2. Navigate to **Settings → API**
3. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
4. Copy **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Anthropic
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Navigate to **API Keys**
3. Create a new key → `ANTHROPIC_API_KEY`

---

## Deploy to Vercel

1. Push code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Import Project** → select your repo
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Click **Deploy**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Forms | react-hook-form + zod |
| Dates | date-fns |

---

## Project Structure

```
app/
  (auth)/          # Login & register pages
  (dashboard)/     # Protected app pages
  api/             # API routes (transfer, ai, user)
components/
  ui/              # Reusable UI components
  layout/          # Sidebar, BottomNav
  dashboard/       # Dashboard-specific components
lib/
  supabase/        # Supabase clients (browser, server, middleware)
  utils.ts         # Utility functions
types/
  index.ts         # TypeScript types & constants
supabase/
  schema.sql       # Full database schema
```
