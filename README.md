# Nepal Electricity Market Clearing Engine

Double-sided auction clearing for 15-minute slots, fed by a Google Form / Sheet, with settlement
statements, PDF reports and email notifications to participants.

## Run locally
```bash
npm install --legacy-peer-deps
cp .env.example .env      # fill in EMAIL_SENDER and EMAIL_APP_PASSWORD
npm run dev               # http://localhost:3000
npm test                  # engine + mailer tests
```

## Email setup
Credentials are **server environment variables only**. They are never in the browser or the repo.

| Variable | Purpose |
|---|---|
| `EMAIL_SENDER` | Gmail address that sends the mail |
| `EMAIL_APP_PASSWORD` | 16-letter Google App Password (spaces ignored) |
| `ADMIN_PASSCODE` | Typed once in the Email tab; required in production so only you can send |
| `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | Optional |
| `GOOGLE_APPS_SCRIPT_URL`, `GAS_SHARED_SECRET` | Free-plan route (below) |

Create the App Password: Google Account > Security > 2-Step Verification (on) > App passwords.

### Deploying on Render
Render's **free** web services block outbound SMTP (ports 25/465/587), so a Gmail App Password
cannot connect from them. Choose one:
1. **Paid instance** (e.g. Starter): set the variables above; mail goes via Gmail SMTP.
2. **Free plan**: deploy `apps-script/Code.gs` as a Web app from the sending Gmail account, then set
   `GOOGLE_APPS_SCRIPT_URL` and `GAS_SHARED_SECRET`. Mail goes over HTTPS from the same Gmail.
   (Apps Script limit: about 100 recipients/day on consumer Gmail.)

With `EMAIL_PROVIDER=auto` (default) the server probes the network and picks the working route.
In the app: **Email > Email Delivery & Setup > Verify connection > Send test email.**

## Clearing rules
- One bid per participant, side and slot: a resubmission replaces the earlier one.
- Uniform price: MCP is the marginal accepted offer; buyers at or above and sellers at or below it are accepted, ties by timestamp then row order.
- Settlement = MCP (NRs/kWh) x MW x 0.25 h x 1000, allocated in whole paisa so buyers' payments equal sellers' receipts exactly (shown as an audit check in the Settlement tab).
