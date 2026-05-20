# Topos

Topos is an experimental SNS where posts are ranked by contribution to the field,
not follower counts.

## Requirements

- Node.js 20+
- npm 10+

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Run

```bash
npm install
npm run build
npm run start
```

## Environment Variables

This MVP currently does not require mandatory environment variables.

Optional:

- `PORT`: server port for `npm run start`

## Data Persistence (MVP)

The app persists runtime data into `data/topos-db.json`.

- Auto-save happens on mutations (create post/thread, reactions, moderation, profile updates).
- This file is intentionally excluded from git.

## Backup / Restore

### Backup

```bash
copy data\topos-db.json data\topos-db.backup.json
```

### Restore

```bash
copy /Y data\topos-db.backup.json data\topos-db.json
```

After restore, restart the app.

## Notes

- Authentication is cookie-based pseudo auth in this MVP.
- Full PostgreSQL/Auth.js migration remains a separate roadmap item.
