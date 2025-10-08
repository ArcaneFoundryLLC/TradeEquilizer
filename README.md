# TradeEqualizer

A Next.js application for trade equalization built with Supabase authentication and database.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local development)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TradeEquilizer
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to your [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project (or create a new one)
   - Go to Settings → API
   - Copy the Project URL and anon/public key

3. Update `.env.local` with your actual values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
   ```

### 4. Set Up the Database (Optional - for local development)

If you want to run Supabase locally:

1. Start Supabase locally:
   ```bash
   npx supabase start
   ```

2. Run the database migrations:
   ```bash
   npx supabase db reset
   ```

3. Update your `.env.local` to use local Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
   ```

### 5. Run the Development Server

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

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard page
│   ├── login/             # Login page
│   └── signup/            # Signup page
├── components/            # React components
│   ├── ui/                # UI components
│   └── ProtectedRoute.tsx # Route protection
├── contexts/              # React contexts
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   └── supabase/          # Supabase client configuration
└── types/                 # TypeScript type definitions

supabase/
├── migrations/            # Database migrations
├── config.toml           # Supabase configuration
└── seed.sql              # Database seed data
```

## Features

- **Authentication**: User signup, login, and session management with Supabase Auth
- **Protected Routes**: Automatic redirection for unauthenticated users
- **Database Integration**: PostgreSQL database with Supabase
- **Modern UI**: Built with Tailwind CSS and modern React patterns
- **TypeScript**: Full TypeScript support for type safety

## Available Scripts

- `npm run dev` - Start the development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Start the production server

## Database Schema

The application uses the following main entities:
- Users (managed by Supabase Auth)
- Additional tables defined in the migrations

See `docs/database-schema.md` for detailed schema information.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit them: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Supabase Documentation](https://supabase.com/docs) - learn about Supabase features
- [Tailwind CSS](https://tailwindcss.com/docs) - utility-first CSS framework

## Local Catalog: Import and Search (Testing)

For quick testing without full bulk import:

1. Generate a small MTG items seed from Scryfall:
   
   ```bash
   node scripts/generate-seed-items.mjs
   ```
   
   This writes SQL to `supabase/seed_items.sql`.

2. Apply the SQL to your Supabase project (SQL Editor or CLI). The insert uses `ON CONFLICT (scryfall_id) DO NOTHING`.

3. Test the local search endpoint:
   
   ```bash
   curl 'http://localhost:3000/api/cards/search?q=lotus&limit=10'
   ```
   
   You should receive `{ data, total, page, limit }`. The UI at `/trades/search` will prefer local results and fall back to Scryfall when empty.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in the Vercel dashboard
4. Deploy!

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
