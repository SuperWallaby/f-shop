#!/usr/bin/env bash
set -euo pipefail

# Registers WhatsApp templates (v8) in Twilio Content API.
# v8 rules:
# - No colon characters ":" in the message body.
# - Keep variables minimal (2 vars: date, time) to reduce INVALID_FORMAT risk.
# - Include sample values via Twilio "variables" field.
#
# Requires (from environment OR .env.local):
# - TWILIO_ACCOUNT_SID
# - TWILIO_AUTH_TOKEN
#
# Usage:
#   bash scripts/register-twilio-whatsapp-templates-v8.sh

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
# Templates (v8, no ":" in body)
# Twilio variables: {{1}}, {{2}}, ...
# ---------------------------------------------------------------------------

# Shared sample values (date/time)
SAMPLE_VARS="$(cat <<'JSON'
{"1":"2026-01-20","2":"7:00 PM"}
JSON
)"

# 1) Booking confirmed (v8)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_booking_confirmed_en_v8" "$(cat <<'JSON'
"Fasea Pilates booking confirmed\nDate {{1}}\nTime {{2}}\nReference https://fasea.plantweb.io/info/booking"
JSON
)" "${SAMPLE_VARS}"

# 2) Reminder (v8)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_booking_reminder_en_v8" "$(cat <<'JSON'
"Fasea Pilates booking reminder\nDate {{1}}\nTime {{2}}\nReference https://fasea.plantweb.io/info/booking"
JSON
)" "${SAMPLE_VARS}"

# 3) Cancelled by client (v8)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_booking_cancelled_by_client_en_v8" "$(cat <<'JSON'
"Fasea Pilates booking cancelled\nDate {{1}}\nTime {{2}}\nReference https://fasea.plantweb.io/info/booking"
JSON
)" "${SAMPLE_VARS}"

# 4) Cancelled by instructor (v8)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_class_cancelled_by_instructor_en_v8" "$(cat <<'JSON'
"Fasea Pilates class cancelled\nDate {{1}}\nTime {{2}}\nReference https://fasea.plantweb.io/info/booking"
JSON
)" "${SAMPLE_VARS}"

# 5) No-show (v8)
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_no_show_en_v8" "$(cat <<'JSON'
"Fasea Pilates attendance not recorded\nDate {{1}}\nTime {{2}}\nReference https://fasea.plantweb.io/info/booking"
JSON
)" "${SAMPLE_VARS}"

echo "Done. Copy the returned Content SIDs (HX...) into your notes/env."

