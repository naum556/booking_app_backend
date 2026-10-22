# Booking API

REST API for a time-slot booking app, built with [NestJS](https://docs.nestjs.com),
[TypeORM](https://typeorm.io) and PostgreSQL. Clients create time slots and then
book them; each slot can hold at most one booking.

The companion frontend lives in the sibling `timeslot-booking` repo. It talks to
this API through same-origin paths (`/time-slots`, `/bookings`) in development,
where its Vite dev server proxies to this API.

## Stack

| Piece      | Choice                                          |
| ---------- | ----------------------------------------------- |
| Framework  | NestJS 12                                       |
| ORM        | TypeORM                                         |
| Database   | PostgreSQL (tested against Neon, works with any Postgres) |
| Validation | `class-validator` + global `ValidationPipe`     |
| Runtime    | Node.js 24 (see `.nvmrc`)                       |
| AI messages | [OpenRouter](https://openrouter.ai) via `@openrouter/sdk` |

## Quick start

```bash
npm ci

# Create .env and set DATABASE_URL (required).
# Set OPENROUTER_API_KEY too if you want AI-written booking confirmations.
cp .env.example .env

# Development (watch mode, listens on PORT or 3000)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

Health check: `GET /` returns `200` with the body `Hello World!`.

## Configuration

All configuration is read from environment variables (via `@nestjs/config`, which
loads `.env` in development).

| Variable                | Required | Default | Description                                                        |
| ----------------------- | -------- | ------- | ------------------------------------------------------------------ |
| `DATABASE_URL`          | **yes**  | —       | Postgres connection string, e.g. `postgres://user:pass@host/neondb?sslmode=require` |
| `PORT`                  | no       | `3000`  | HTTP port. Render injects this automatically.                      |
| `CORS_ORIGIN`           | no       | unset   | Comma-separated allowed origins. CORS is **disabled** when unset.  |
| `DB_RETRY_ATTEMPTS`     | no       | `10`    | TypeORM connection retry count (cold-start tolerance).             |
| `DB_RETRY_DELAY_MS`     | no       | `3000`  | Delay between connection retries.                                  |
| `DB_CONNECT_TIMEOUT_MS` | no       | `15000` | Per-attempt connection timeout.                                    |
| `OPENROUTER_API_KEY` | no       | —       | OpenRouter API key. Enables AI-written booking confirmation messages; without it a static message is returned (see [AI confirmation messages](#ai-confirmation-messages)). |
| `OPENROUTER_MODEL`   | no       | `minimax/minimax-m3.1-flash:free` | Chat model used to write confirmation messages.                     |

> **Why the retry settings?** Serverless Postgres (e.g. Neon) suspends idle
> databases, so the first connection after a cold start can be slow or fail once.
> Nest only binds its HTTP port *after* the DB connects, so without retries a cold
> start makes the whole API unreachable. Bump the values above if your database
> cold-starts slowly.

### CORS

The API is same-origin by default. To let a browser call it cross-origin (e.g. a
frontend hosted on a different domain), set `CORS_ORIGIN`:

```bash
CORS_ORIGIN=https://my-frontend.com,http://localhost:5173
```

## AI confirmation messages

When a booking is created, the API returns a short confirmation sentence written
by an LLM through [OpenRouter](https://openrouter.ai) (the `message` field on
`POST /bookings` responses). Enable it by setting a key in `.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
# Optional: pick a different chat model (must be a text/chat model, not an embedding model)
OPENROUTER_MODEL=minimax/minimax-m3.1-flash:free
```

Example message:

```text
Hi Ada, your booking is confirmed for November 15, 2026 at 9:00 AM for 30 minutes.
```

The AI call is **best-effort and never blocks a booking**:

- It runs after the booking row is saved, so creating a booking always succeeds
  even if the model call fails.
- An empty response is retried once, and each attempt gives up after 20
  seconds.
- If the key is missing, the model errors or times out, a static fallback
  message is returned instead (and the reason is logged as a warning).

Messages are generated only on create — they are not stored, and
`GET /bookings` does not return them.

> **Model note:** embedding models (e.g. `nvidia/nemotron-3.5-embed-1b:free`)
> return number vectors rather than text and cannot be used here. The default is
> a non-reasoning free chat model, because some free reasoning models spend their
> whole token budget on reasoning and return empty content for short prompts.

## API

- Base path: the service root (e.g. `https://your-app.onrender.com`).
- All request and response bodies are JSON. Send `Content-Type: application/json`.
- `id` values are UUIDs. `:id` parameters are validated with a UUID pipe: a
  malformed UUID returns `400`, a well-formed but unknown UUID returns `404`.

### Entities

**TimeSlot**

```json
{
  "id": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
  "date": "2026-11-15",
  "time": "09:00:00",
  "duration": 30,
  "booking": null,
  "createdAt": "2026-10-21T17:15:55.168Z"
}
```

| Field      | Type                  | Notes                                              |
| ---------- | --------------------- | -------------------------------------------------- |
| `id`       | UUID                  | Generated server-side.                             |
| `date`     | `YYYY-MM-DD`          | Stored as Postgres `date`.                         |
| `time`     | `HH:mm:ss`            | Stored as Postgres `time`; `HH:mm` is accepted on input. |
| `duration` | integer               | Minutes.                                           |
| `booking`  | `Booking` \| `null`   | Present on list/get; `null` when unbooked. Omitted on create. |
| `createdAt`| ISO 8601 timestamp    | Generated server-side.                             |

**Booking**

```json
{
  "id": "0374c42f-0698-49a9-be2c-f7e2c8a5acf2",
  "name": "Test User",
  "email": "test@example.com",
  "timeSlot": { "id": "40393236-a346-4f7a-8540-3d5c9de6a2a1", "date": "2026-11-15", "time": "09:00:00", "duration": 30, "createdAt": "2026-10-21T17:15:55.168Z" },
  "timeSlotId": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
  "createdAt": "2026-10-21T17:16:32.548Z"
}
```

| Field       | Type                | Notes                                            |
| ----------- | ------------------- | ------------------------------------------------ |
| `id`        | UUID                | Generated server-side.                           |
| `name`      | string              | Required, non-empty.                             |
| `email`     | string              | Required, must be a valid email.                 |
| `timeSlotId`| UUID                | The slot being booked.                           |
| `timeSlot`  | `TimeSlot`          | Present on list/get only, **not** on create.     |
| `createdAt` | ISO 8601 timestamp  | Generated server-side.                           |

The `POST /bookings` response additionally includes a `message` string (the AI
confirmation — see [AI confirmation messages](#ai-confirmation-messages)). It is
not part of the entity: the message is not stored and is absent from list/get
responses.

### Endpoints

| Method | Path                | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| `GET`  | `/`                 | Health check (`Hello World!`).           |
| `GET`  | `/time-slots`       | All slots, each with its `booking`.      |
| `GET`  | `/time-slots/available` | Only unbooked slots (no `booking` key). |
| `GET`  | `/time-slots/:id`   | One slot, with its `booking`.            |
| `POST` | `/time-slots`       | Create a slot.                           |
| `GET`  | `/bookings`         | All bookings, newest first, each with `timeSlot`. |
| `GET`  | `/bookings/:id`     | One booking, with `timeSlot`.            |
| `POST` | `/bookings`         | Book a slot.                             |

There are no update or delete endpoints.

---

### `GET /`

Health check. Returns `200` with the plain-text body `Hello World!`. Used as the
Render health-check path.

---

### `GET /time-slots`

Returns every slot ordered by `date` ascending, then `time` ascending. Each slot
includes its `booking` (or `null` if unbooked).

```bash
curl https://your-app.onrender.com/time-slots
```

```json
[
  {
    "id": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
    "date": "2026-11-15",
    "time": "09:00:00",
    "duration": 30,
    "booking": null,
    "createdAt": "2026-10-21T17:15:55.168Z"
  },
  {
    "id": "49be18ce-5d59-4df8-9884-9ea8d0f9a453",
    "date": "2026-10-21",
    "time": "12:00:00",
    "duration": 30,
    "booking": {
      "id": "9a25ada0-79fb-470d-9900-c28ed5bf4f6c",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "createdAt": "2026-10-20T23:05:55.730Z"
    },
    "createdAt": "2026-10-20T23:05:51.860Z"
  }
]
```

---

### `GET /time-slots/available`

Same as `/time-slots` but returns only unbooked slots. The `booking` field is
**omitted entirely** (not `null`) on these items.

```json
[
  {
    "id": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
    "date": "2026-11-15",
    "time": "09:00:00",
    "duration": 30,
    "createdAt": "2026-10-21T17:15:55.168Z"
  }
]
```

---

### `GET /time-slots/:id`

Returns one slot including its `booking` (`null` when unbooked).

```bash
curl https://your-app.onrender.com/time-slots/40393236-a346-4f7a-8540-3d5c9de6a2a1
```

| Status | When                                             |
| ------ | ------------------------------------------------ |
| `200`  | Found.                                           |
| `400`  | `:id` is not a valid UUID.                       |
| `404`  | Valid UUID, but no such slot.                    |

`404` body:

```json
{
  "message": "Time slot with id 00000000-0000-0000-0000-000000000000 not found",
  "error": "Not Found",
  "statusCode": 404
}
```

---

### `POST /time-slots`

Creates a time slot. Returns the created slot (`201`); `booking` is omitted
because a new slot is unbooked.

**Request body**

| Field      | Required | Type / format                     | Constraints          |
| ---------- | -------- | --------------------------------- | -------------------- |
| `date`     | yes      | `YYYY-MM-DD` (ISO 8601 date)      | Must be a valid date.|
| `time`     | yes      | `HH:mm` or `HH:mm:ss`             | 24-hour clock, minutes/seconds `00`–`59`. |
| `duration` | yes      | integer                           | Minimum `1` (minutes). |

```bash
curl -X POST https://your-app.onrender.com/time-slots \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-11-15","time":"09:00","duration":30}'
```

```json
{
  "id": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
  "date": "2026-11-15",
  "time": "09:00",
  "duration": 30,
  "createdAt": "2026-10-21T17:15:55.168Z"
}
```

**Errors** — validation failures return `400` with `message` as an array of
strings. Unknown fields are rejected too (`forbidNonWhitelisted`).

```json
{ "message": ["time must be in HH:mm or HH:mm:ss format"], "error": "Bad Request", "statusCode": 400 }
{ "message": ["property bogus should not exist"], "error": "Bad Request", "statusCode": 400 }
```

Duplicate slots are allowed — nothing prevents creating two slots with the same
date and time.

---

### `GET /bookings`

All bookings, newest first (`createdAt` descending), each nested with its
`timeSlot`.

```json
[
  {
    "id": "0374c42f-0698-49a9-be2c-f7e2c8a5acf2",
    "name": "Test User",
    "email": "test@example.com",
    "timeSlot": {
      "id": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
      "date": "2026-11-15",
      "time": "09:00:00",
      "duration": 30,
      "createdAt": "2026-10-21T17:15:55.168Z"
    },
    "timeSlotId": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
    "createdAt": "2026-10-21T17:16:32.548Z"
  }
]
```

Note the nested `timeSlot` here has **no** `booking` field (avoids recursion).

---

### `GET /bookings/:id`

Returns one booking with its nested `timeSlot`.

| Status | When                                        |
| ------ | ------------------------------------------- |
| `200`  | Found.                                      |
| `400`  | `:id` is not a valid UUID.                  |
| `404`  | Valid UUID, but no such booking.            |

---

### `POST /bookings`

Books an available time slot.

**Request body**

| Field       | Required | Type   | Constraints                       |
| ----------- | -------- | ------ | --------------------------------- |
| `timeSlotId`| yes      | UUID   | Must reference an existing slot.  |
| `name`      | yes      | string | Non-empty.                        |
| `email`     | yes      | string | Must be a valid email.            |

```bash
curl -X POST https://your-app.onrender.com/bookings \
  -H 'Content-Type: application/json' \
  -d '{"timeSlotId":"40393236-a346-4f7a-8540-3d5c9de6a2a1","name":"Ada Lovelace","email":"ada@example.com"}'
```

```json
{
  "id": "0374c42f-0698-49a9-be2c-f7e2c8a5acf2",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "timeSlotId": "40393236-a346-4f7a-8540-3d5c9de6a2a1",
  "createdAt": "2026-10-21T17:16:32.548Z",
  "message": "Hi Ada, your booking is confirmed for November 15, 2026 at 9:00 AM for 30 minutes."
}
```

The response does **not** include the nested `timeSlot` (create only returns the
booking row). The `message` field is written by an LLM when
`OPENROUTER_API_KEY` is configured, and falls back to a static confirmation
sentence otherwise — booking creation never fails because of it (see
[AI confirmation messages](#ai-confirmation-messages)).

**Errors**

| Status | Condition                                       | Body `message`                             |
| ------ | ----------------------------------------------- | ------------------------------------------ |
| `400`  | Invalid body (bad UUID, bad email, empty name). | Array of validation messages.              |
| `404`  | `timeSlotId` does not reference an existing slot. | `Time slot with id <id> not found`       |
| `409`  | The slot is already booked.                     | `This time slot is already booked`         |

```json
{ "message": "This time slot is already booked", "error": "Conflict", "statusCode": 409 }
```

Each slot holds at most one booking. The service checks for an existing booking
and also catches the unique-constraint violation (`23505`) on `time_slot_id`, so
concurrent double-bookings still fail with `409` rather than a `500`.

### Error format

All errors use the standard NestJS shape:

```json
{ "message": "...", "error": "Bad Request", "statusCode": 400 }
```

`message` is a string, or an array of strings for validation failures.

## Testing

```bash
npm run test        # unit tests (vitest)
npm run test:e2e    # end-to-end tests
npm run test:cov    # coverage
npm run lint        # oxlint (type-aware)
```

## Deploying to Render

This repo ships a [`render.yaml`](./render.yaml) blueprint, so setup is a few
clicks.

1. Push this repo to GitHub.
2. In the [Render dashboard](https://dashboard.render.com), choose **New →
   Blueprint**, connect the repo, and select this branch. Render reads
   `render.yaml` and creates the web service with the right build/start commands
   and health check.
3. When prompted, set **`DATABASE_URL`** to your Postgres connection string
   (e.g. from [Neon](https://neon.tech)). It is marked `sync: false`, so Render
   stores it as a secret rather than in the blueprint.
4. Deploy. The service listens on the `PORT` Render injects.

Manual setup (without the blueprint) — the equivalent settings:

| Setting         | Value                                          |
| --------------- | ---------------------------------------------- |
| Runtime         | Node                                          |
| Build command   | `npm ci && npm run build`                      |
| Start command   | `npm run start:prod`                           |
| Health check    | `/`                                            |
| Node version    | 24 (from `.nvmrc`)                             |
| Env vars        | `DATABASE_URL` (required), optional `CORS_ORIGIN`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `PORT` (set by Render) |

If the frontend is served from a different origin, set `CORS_ORIGIN` on the
service to the frontend's URL, e.g. `https://my-frontend.netlify.app`.

### Notes

- `synchronize: true` is enabled in `app.module.ts`, so TypeORM applies schema
  changes on boot. That is convenient for development but risky in production —
  consider switching to migrations before the schema grows.
- Free-tier Postgres (e.g. a suspended Neon compute) cold-starts on the first
  request after idle; see the retry settings under [Configuration](#configuration).

## Project structure

```
src/
├── main.ts                       # bootstrap, ValidationPipe, opt-in CORS, PORT
├── app.module.ts                 # ConfigModule + TypeOrmModule (Postgres)
├── app.controller.ts             # GET /
├── ai/
│   ├── ai.module.ts              # global module exporting AiService
│   └── ai.service.ts             # OpenRouter client, retry/timeout/fallback
├── time-slots/
│   ├── time-slots.controller.ts  # /time-slots routes
│   ├── time-slots.service.ts     # queries, ordering, available filter
│   ├── dto/create-time-slot.dto.ts
│   └── entities/time-slot.entity.ts
└── bookings/
    ├── bookings.controller.ts    # /bookings routes
    ├── bookings.service.ts       # booking + double-booking guards, AI confirmation
    ├── dto/create-booking.dto.ts
    └── entities/booking.entity.ts
```
