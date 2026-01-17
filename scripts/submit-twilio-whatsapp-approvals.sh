#!/usr/bin/env bash
set -euo pipefail

# Bulk-submit WhatsApp template approvals for Twilio Content (HX...).
#
# Requires (from environment OR .env.local):
# - TWILIO_ACCOUNT_SID
# - TWILIO_AUTH_TOKEN
#
# Usage:
#   bash scripts/submit-twilio-whatsapp-approvals.sh
#
# Optional:
#   TWILIO_WHATSAPP_TEMPLATE_CATEGORY="UTILITY" (default)
#
# Notes:
# - Twilio/Meta approval may still take time.
# - If submission fails, the API response will explain what field is missing.

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

CATEGORY="${TWILIO_WHATSAPP_TEMPLATE_CATEGORY:-UTILITY}"

# These are the Content SIDs created by scripts/register-twilio-whatsapp-templates.sh
# The WhatsApp approval endpoint also requires a "name" (Meta template name).
CONTENT_ITEMS=(
  "HX8eb56c76730f61160facb74d91acd32a fasea_booking_confirmed_en_v7"
  "HXaf5345bb90988367047251d07dcf7f36 fasea_booking_reminder_en_v7"
  "HXde78c084556bb1672cf7f85d8d26e927 fasea_booking_cancelled_by_client_en_v7"
  "HXa1e64586469081388ed540d7c50f0269 fasea_class_cancelled_by_instructor_en_v7"
  "HXa1256393456f0496ca3679231572e00a fasea_no_show_en_v7"
)

submit_one() {
  local content_sid="$1"
  local template_name="$2"
  local url="https://content.twilio.com/v1/Content/${content_sid}/ApprovalRequests/whatsapp"

  echo "==> Submitting approval: ${content_sid} (${template_name})"

  local res
  res="$(curl -sS -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST \
    "${url}" \
    -d "{\"name\":\"${template_name}\",\"category\":\"${CATEGORY}\"}" || true)"

  echo "${res}"
  echo ""
}

for item in "${CONTENT_ITEMS[@]}"; do
  content_sid="$(echo "${item}" | awk '{print $1}')"
  template_name="$(echo "${item}" | awk '{print $2}')"
  submit_one "${content_sid}" "${template_name}"
done

echo "Done. Check Twilio Console -> Messaging -> Content for Pending/Approved status."

