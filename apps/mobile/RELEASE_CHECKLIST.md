# Faséa Mobile Release Checklist

## Configuration

- Default API: `https://fasea.studio`
- Override for local/staging:

```sh
flutter run --dart-define=API_BASE_URL=https://your-api.example.com
```

## Android

- App label is `Faséa`.
- Internet permission is enabled in `android/app/src/main/AndroidManifest.xml`.
- Before internal testing:

```sh
flutter build appbundle --release --dart-define=API_BASE_URL=https://fasea.studio
```

## iOS

- Display name is `Faséa`.
- Before TestFlight:

```sh
flutter build ipa --release --dart-define=API_BASE_URL=https://fasea.studio
```

## Smoke Tests

- Email auth creates or signs in a user.
- Name completion appears for accounts without a saved name.
- No-credit users land on Membership and can open WhatsApp payment.
- Credited users can select class type, date, slot, and submit booking.
- Booking Check can search and cancel.
- Events list loads active events and opens WhatsApp inquiry.
- Staff password unlocks Manage.
- Manage can toggle plan/event active state and create basic plan/event rows.

## Assets

- Replace default Flutter launcher icons before store submission.
- Replace default launch screen artwork before store submission.
