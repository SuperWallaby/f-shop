#!/usr/bin/env bash
set -euo pipefail

# Registers WhatsApp templates in Twilio Content API.
# Requires (from environment OR .env.local):
# - TWILIO_ACCOUNT_SID
# - TWILIO_AUTH_TOKEN
#
# Usage:
#   # Preferred: set values in .env.local (repo root)
#   bash scripts/register-twilio-whatsapp-templates.sh
#
#   # Or export manually
#   export TWILIO_ACCOUNT_SID="AC..."
#   export TWILIO_AUTH_TOKEN="..."
#   bash scripts/register-twilio-whatsapp-templates.sh
#
# Notes:
# - This creates Content items. WhatsApp approval/review may still be required.
# - Save the returned Content SIDs (HX...) somewhere safe.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${TWILIO_ACCOUNT_SID:-}" || -z "${TWILIO_AUTH_TOKEN:-}" ]]; then
  if [[ -f "${ROOT_DIR}/.env.local" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "${ROOT_DIR}/.env.local"
    set +a
  fi
fi

ACCOUNT_SID="${TWILIO_ACCOUNT_SID:?Missing TWILIO_ACCOUNT_SID (set it in .env.local or export it)}"
AUTH_TOKEN="${TWILIO_AUTH_TOKEN:?Missing TWILIO_AUTH_TOKEN (set it in .env.local or export it)}"

post_content() {
  local friendly_name="$1"
  local body="$2"
  local variables="${3:-}"

  echo "==> Creating: ${friendly_name}"

  local payload
  if [[ -n "${variables}" ]]; then
    payload="$(cat <<JSON
{
  "friendly_name": "${friendly_name}",
  "language": "en",
  "types": {
    "twilio/text": {
      "body": ${body}
    }
  },
  "variables": ${variables}
}
JSON
)"
  else
    payload="$(cat <<JSON
{
  "friendly_name": "${friendly_name}",
  "language": "en",
  "types": {
    "twilio/text": {
      "body": ${body}
    }
  }
}
JSON
)"
  fi

  curl -sS -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST \
    "https://content.twilio.com/v1/Content" \
    -d "${payload}"

  echo ""
  echo ""
}

# ---------------------------------------------------------------------------
# Templates (match src/lib/bookingMessages.ts)
# Twilio variables: {{1}}, {{2}}, ...
# ---------------------------------------------------------------------------

# 1) Booking confirmed (v7; reduce variables)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_booking_confirmed_en_v7" "$(cat <<'JSON'
"Booking status update: confirmed.\nDate: {{1}}\nTime: {{2}}\nReference: https://fasea.plantweb.io/info/booking"
JSON
)" "$(cat <<'JSON'
{"1":"2026-01-20","2":"7:00 PM"}
JSON
)"

# 2) Reminder (v7; keep 2 variables)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_booking_reminder_en_v7" "$(cat <<'JSON'
"Booking status update: reminder.\nDate: {{1}}\nTime: {{2}}\nReference: https://fasea.plantweb.io/info/booking"
JSON
)" "$(cat <<'JSON'
{"1":"2026-01-20","2":"7:00 PM"}
JSON
)"

# 3) Cancelled by client (v7; reduce variables)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_booking_cancelled_by_client_en_v7" "$(cat <<'JSON'
"Booking status update: cancelled.\nDate: {{1}}\nTime: {{2}}\nReference: https://fasea.plantweb.io/info/booking"
JSON
)" "$(cat <<'JSON'
{"1":"2026-01-20","2":"7:00 PM"}
JSON
)"

# 4) Cancelled by instructor (v7; reduce variables)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_class_cancelled_by_instructor_en_v7" "$(cat <<'JSON'
"Booking status update: class cancelled.\nDate: {{1}}\nTime: {{2}}\nReference: https://fasea.plantweb.io/info/booking"
JSON
)" "$(cat <<'JSON'
{"1":"2026-01-20","2":"7:00 PM"}
JSON
)"

# 5) No-show (v7; reduce variables)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_no_show_en_v7" "$(cat <<'JSON'
"Booking status update: attendance not recorded.\nDate: {{1}}\nTime: {{2}}\nReference: https://fasea.plantweb.io/info/booking"
JSON
)" "$(cat <<'JSON'
{"1":"2026-01-20","2":"7:00 PM"}
JSON
)"

echo "Done. Copy the returned Content SIDs (HX...) into your notes/env."

