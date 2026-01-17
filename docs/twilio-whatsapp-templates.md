# Twilio WhatsApp Templates (How to register + use)

This project sends WhatsApp messages via Twilio using the **Programmable Messaging API** (`/Messages.json`) in `src/lib/twilioWhatsApp.ts`.

## When you need “templates”

WhatsApp has a 24‑hour customer-care window:

- **Inside 24 hours after a customer messages you**: you can usually send **free-form** WhatsApp messages (no template).
- **Outside that 24‑hour window** (proactive notifications like booking confirmations/reminders/cancellations): WhatsApp requires an **approved template**.

Twilio implements templates via **Content API / Content Templates** (sometimes shown in the Twilio Console as “Content Template Builder”).

## Prerequisites (Twilio / WhatsApp)

- A Twilio account with WhatsApp enabled (either sandbox for testing, or an approved WhatsApp sender for production).
- You know your:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_WHATSAPP_FROM` (E.164 number, e.g. `+14155238886`)
  - `TWILIO_WHATSAPP_TO` (admin number, E.164, e.g. `+60145403560`) — used by this repo for admin notifications

These env vars are already referenced in:
- `src/lib/twilioWhatsApp.ts`
- `env.template`

## Option A — Create templates in Twilio Console (recommended)

1. Open the Twilio Console.
2. Go to **Messaging** → **Content** (or **Content Template Builder**).
3. Create a new template:
   - **Channel**: WhatsApp
   - **Language**: pick one (e.g. `en`)
   - **Category**: transactional/utility (for booking-related messages)
4. Use **variables** for dynamic fields (Twilio will show the supported syntax in the UI).
   - Common fields: customer name, class type, date, time, booking code.
5. Submit for approval.
6. After approval, copy the **Content SID** (looks like `HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).

Keep a small list of Content SIDs per message kind, e.g.:
- booking confirmation template SID
- booking reminder template SID
- cancellation template SID
- no-show template SID

## Option B — Create templates via API (curl)

Twilio’s Content API is easiest for automation. Refer to Twilio’s official docs:
- `https://www.twilio.com/docs/content`

Example pattern (you will need to adapt fields to Twilio’s current API shape):

```bash
ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

curl -u "$ACCOUNT_SID:$AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  "https://content.twilio.com/v1/Content" \
  -d '{
    "friendly_name": "booking_confirmed_en",
    "language": "en",
    "types": {
      "twilio/text": {
        "body": "Hi {{1}} 🤍\nYour Pilates class booking is confirmed.\n\nClass Type: {{2}}\n🗓 Date: {{3}}\n⏰ Time: {{4}}\nBooking Code: {{5}}\n\nPlease bring grip socks...\n"
      }
    }
  }'
```

The response will include a Content SID like `HX...`. Save it.

### One-shot script (recommended for this repo)

This repo includes a script that registers all booking-related templates defined in `src/lib/bookingMessages.ts`:

- booking confirmed
- reminder
- cancelled by client
- cancelled by instructor
- no-show (first timer + standard)

Run:

```bash
bash scripts/register-twilio-whatsapp-templates.sh
```

The script will auto-load `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` from `.env.local` (repo root) if present. You can also `export` them manually.

It will print the JSON responses for each template. Copy the returned `sid` (Content SID, `HX...`) values for later use.

## Wire templates into this repo (required outside the 24-hour window)

Set these in `.env.local` after your templates are approved:

- `TWILIO_CONTENT_SID_BOOKING_CONFIRMED_EN`
- `TWILIO_CONTENT_SID_BOOKING_REMINDER_EN`
- `TWILIO_CONTENT_SID_BOOKING_CANCELLED_BY_CLIENT_EN`
- `TWILIO_CONTENT_SID_CLASS_CANCELLED_BY_INSTRUCTOR_EN`
- `TWILIO_CONTENT_SID_NO_SHOW_FIRST_TIMER_EN`
- `TWILIO_CONTENT_SID_NO_SHOW_EN`

This repo will automatically use `ContentSid + ContentVariables` for customer WhatsApp messages when these are present, and fall back to `Body` when they are not.

## How templates are used when sending (concept)

When using Twilio Content Templates, you typically send a WhatsApp message by providing:

- **From**: `whatsapp:+<TWILIO_WHATSAPP_FROM>`
- **To**: `whatsapp:+<customer>`
- Either:
  - **Body** (free-form text), or
  - **ContentSid** + **ContentVariables** (template + variables)

This repo currently sends WhatsApp using a plain **Body**:

- `src/lib/twilioWhatsApp.ts` → `sendTwilioWhatsApp({ to, body })`

So: registering templates in Twilio is step 1, but **to actually use them outside the 24‑hour window**, we’d need a small code change to send `ContentSid` + `ContentVariables` instead of `Body`.

If you want, tell me which message kinds you want templated first (booking_confirmed / reminder / cancelled / no_show), and I’ll add:
- env vars for the Content SIDs
- a `sendTwilioWhatsAppTemplate(...)` helper
- a safe fallback to `Body` for dev/testing

## Suggested template set for this project

These map cleanly to the message builders in `src/lib/bookingMessages.ts`:

- **Booking confirmed**
  - Variables: name, class type, date label, time label, booking code
- **Reminder**
  - Variables: date label, time label
- **Cancelled by client**
  - Variables: name, class type, date label, time label
- **Cancelled by instructor**
  - Variables: class type, date label, time label
- **No show**
  - Variables: name (and optional “first timer” variant)

## Notes / pitfalls

- **Approval can take time**: don’t assume templates are instantly usable.
- **Keep wording stable**: frequent edits may require re-approval.
- **Variable formatting**: this repo formats date/time in KL timezone before sending (good).
- **WhatsApp sender**: sandbox is fine for test; production requires a proper WhatsApp sender approval.

