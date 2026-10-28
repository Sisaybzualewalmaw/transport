# ET-Trans Passenger Mobile App

Flutter app for passenger authentication, trip search, seat holds, mock
Telebirr/CBE Birr checkout, and locally stored digital tickets.

## Run

Requirements: Flutter 3.22+ and Dart 3.4+.

```powershell
cd mobile
flutter create --org com.woldia --project-name et_trans_passenger --platforms=android,ios .
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8080
```

`flutter create` supplies the platform runner projects and Gradle/Xcode
wrappers for the installed Flutter SDK. Keep the passenger application source
and `pubspec.yaml`; use the generated iOS project to run on a simulator or
device.

Use `http://10.0.2.2:8080` for an Android emulator to reach the host machine,
`http://localhost:8080` for iOS simulator, or the development machine's LAN IP
for a physical device. The API must be reachable from the device; Android
emulators and physical devices cannot use the host's `localhost`. For a
production build, set the HTTPS API URL:

```powershell
flutter build apk --dart-define=API_BASE_URL=https://transport.example.com
```

The mock checkout calls the authenticated passenger endpoint
`POST /api/bookings/{bookingId}/mock-payment`; it never embeds the payment
webhook secret in the client. Enable `MOCK_PAYMENT_ENABLED=true` on the API
only in demo/test deployments. The app expects the backend to be configured
with PostgreSQL, JWT, and QR signing secrets as documented in
[`../backend/README.md`](../backend/README.md).

The API must include the public `GET /api/locations/cities` endpoint from this
phase. Passengers may search dates and bus grades, hold up to five seats for
ten minutes, and keep issued ticket QR payloads in encrypted platform storage
for offline display. JWTs are stored in secure platform storage and removed on
sign out.
