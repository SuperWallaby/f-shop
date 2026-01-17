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

  echo "==> Creating: ${friendly_name}"

  curl -sS -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST \
    "https://content.twilio.com/v1/Content" \
    -d "{
      \"friendly_name\": \"${friendly_name}\",
      \"language\": \"en\",
      \"types\": {
        \"twilio/text\": {
          \"body\": ${body}
        }
      }
    }"

  echo ""
  echo ""
}

# ---------------------------------------------------------------------------
# Templates (match src/lib/bookingMessages.ts)
# Twilio variables: {{1}}, {{2}}, ...
# ---------------------------------------------------------------------------

# 1) Customer: booking confirmed
# Vars:
#  {{1}} name
#  {{2}} class type
#  {{3}} date label
#  {{4}} time label
#  {{5}} booking code
post_content "fasea_booking_confirmed_en" "$(cat <<'JSON'
"Hi {{1}} 🤍\nYour Pilates class booking is confirmed.\n\nClass Type: {{2}}\n🗓 Date: {{3}}\n⏰ Time: {{4}}\nBooking Code: {{5}}\n\nPlease bring grip socks, wear comfortable attire, and bring a water bottle.\nKindly arrive 10–15 minutes earlier before class.\n\n✨ Cancellation & No-Show Policy:\n• Free cancellation or reschedule at least 12 hours before class\n• Group class: RM10 (late cancellation / no-show)\n• Private session: RM20 (late cancellation / no-show)\n• Fee applies when the slot remains unused\n\nThank you for your understanding 🤍 Looking forward to seeing you ✨"
JSON
)"

# 2) Customer: reminder
# Vars:
#  {{1}} date label
#  {{2}} time label
post_content "fasea_booking_reminder_en" "$(cat <<'JSON'
"Hi Pilates Girls 🤍\nThis is a gentle reminder that you have class tomorrow ({{1}}) at {{2}}.\n\nPlease arrive 15 minutes earlier to prepare before class starts.\nSee you soon 🤍"
JSON
)"

# 3) Customer: cancelled by client
# Vars:
#  {{1}} name
#  {{2}} class type
#  {{3}} date label
#  {{4}} time label
post_content "fasea_booking_cancelled_by_client_en" "$(cat <<'JSON'
"Hi {{1}} ✨\nYour booking for {{2}} on {{3}} at {{4}} has been successfully cancelled as requested.\n\nIf you’d like to rebook, feel free to let us know 🤍"
JSON
)"

# 4) Customer: class cancelled by instructor
# Vars:
#  {{1}} date label
#  {{2}} time label
#  {{3}} class type
post_content "fasea_class_cancelled_by_instructor_en" "$(cat <<'JSON'
"Dear Pilates Girls 💖\nWe regret to inform you that today’s Pilates class on {{1}} at {{2}} has been cancelled due to unforeseen circumstances.\n\nClass Type: {{3}}\n\nWe sincerely apologise for the inconvenience.\nYour session can be rescheduled. Please reach us soon :)\n\nThank you for your understanding 🤍"
JSON
)"

# 5) Customer: no-show (first timer)
# Vars:
#  {{1}} name
post_content "fasea_no_show_first_timer_en" "$(cat <<'JSON'
"Hi {{1}} 🤍\nFor first-time clients, we understand unexpected situations.\n\nA one-time grace may be given for late cancellation or no-show.\nKindly inform us as early as possible for future bookings ✨"
JSON
)"

# 6) Customer: no-show (standard)
# Vars:
#  {{1}} name
post_content "fasea_no_show_en" "$(cat <<'JSON'
"Hi {{1}} 🤍\nWe noticed you were unable to attend your scheduled class today.\n\nAs per studio policy, a no-show fee applies:\n• Group class: RM10\n• Private session: RM20\n\nThis helps us manage class slots fairly.\nThank you for your kind understanding ✨"
JSON
)"

echo "Done. Copy the returned Content SIDs (HX...) into your notes/env."

