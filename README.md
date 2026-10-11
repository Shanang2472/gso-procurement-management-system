## Run Locally

**Prerequisites:**  Node.js

Also start MySQL in XAMPP and import `schema.sql` into the database named by
`MYSQL_DATABASE` (the default is `procurement_management_ocr`). Copy `.env.example`
to `.env.local` and set the database credentials. Use `PORT` to select another
HTTP port if `3000` is already in use.

For an existing `procurement_management_ocr` database, create a backup first and
run the migrations in date order, including the Phase 2, Phase 3, and Phase 4
migrations. Verify the result with `npm run db:verify`.


1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in `.env.local` only if the AI chatbot is enabled
3. Run the app:
   `npm run dev`

### Production Operations

- Build: `npm run build`
- Start: `npm start`
- Liveness check: `GET /health/live`
- Database readiness check: `GET /health/ready`
- Verify required tables: `npm run db:verify`
- Create a backup: `npm run db:backup`
- Restore a backup only after verification: `powershell -ExecutionPolicy Bypass -File scripts/restore-database.ps1 -BackupFile backups\file.sql -Confirm`

Keep `.env.local` out of source control. Production requires `MYSQL_PASSWORD`,
`OTP_SECRET`, and `DOCUMENT_ENCRYPTION_KEY`; configure `MYSQL_*`, `PORT`, `HOST`,
and mail credentials through the deployment environment. Generate a random
32-byte key for `DOCUMENT_ENCRYPTION_KEY` and store it in the deployment secret
manager. Backups should be encrypted, access-controlled, retained according to
the LGU records policy, and restored periodically in a non-production environment.

Uploaded document blobs use AES-256-GCM in production. Legacy rows with
`encryption_version = 0` remain readable for migration. Do not rotate
`DOCUMENT_ENCRYPTION_KEY` without a planned key migration procedure.

### Google sign-in

Google sign-in uses a Google OAuth **Web application** client with Google
Identity Services. In Google Cloud Console, open **APIs & Services >
Credentials**, edit the client whose ID is used by the application, and add
each URL used to open the app under **Authorized JavaScript origins**. Examples:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://192.168.1.25:3000` (replace with the development computer's LAN IP)
- `https://your-production-domain.example` (production only)

Do not add a path, trailing slash, or `/api` to an origin. The scheme, host,
and port must match the browser URL exactly. After saving the client, put the
same client ID in both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` in
`.env.local`, then restart `npm run dev`:

```env
GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com
```

The backend also checks that the Google account email already belongs to an
authorized system user. An origin mismatch is fixed in Google Cloud Console;
it cannot be fixed by changing the `/api/auth/google` route.

The server listens on all network interfaces by default, so another device on the
same network can open the `Network:` URL printed in the terminal, for example
`http://192.168.1.25:3000`. Keep the development computer and test device on the
same Wi-Fi/LAN, and allow Node.js through Windows Defender Firewall if Windows
prompts for access. The network should be set to **Private** in Windows.

To use a different port or bind address, set `PORT` or `HOST` in `.env.local`.
Leave `HOST` unset (or use `0.0.0.0`) for LAN access.
