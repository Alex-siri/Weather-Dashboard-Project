# Weather Dashboard Frontend

This folder contains a Next.js frontend written in plain JavaScript.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Copy the example environment file.

```bash
cp .env.example .env.local
```

3. Point `NEXT_PUBLIC_API_BASE_URL` to your Express backend.
	The current backend listens on `http://localhost:3002`.

4. Start the app.

```bash
npm run dev
```

## Backend routes expected

- `GET /api/weather`
- `GET /api/forecast`

## Project structure

- `app/layout.js`
- `app/page.js`
- `app/globals.css`
