# Transport Scheduling API

This Spring Boot 3 API implements authentication, role-based access control,
fleet management, schedule publishing, and trip search for the project described
in the project PDF. The PDF specifies Spring Boot, stateless JWT authentication,
BCrypt with cost factor 10, and distinct role permissions. This module uses the
four roles in the database schema:
`PASSENGER`, `TERMINAL_CLERK`, `ASSOCIATION_MANAGER`, and `ADMIN`.
The PDF also describes Operator/Driver, Terminal Dispatcher, and ETA Regulator
responsibilities. The current API exposes its implemented dispatch operations
through the existing clerk, association-manager, and admin roles; dedicated
driver/dispatcher/ETA-regulator accounts are not modeled in the existing
`user_role` enum.

## Requirements and database

- Java 17 or newer
- Maven 3.9 or newer
- PostgreSQL with the database schema from the preceding database-design phase
  installed
- The `users` table and PostgreSQL `user_role` and `account_status` enums from
  the database schema previously generated for this project

The application validates the schema at startup (`ddl-auto: validate`). Flyway
adds the current phase's tariff table, bus driver assignment, and schedule
duration with `V1__fleet_schedule_tariffs.sql`. `V2__seat_restrictions.sql`
adds physical-seat restrictions and indexes for expiring locks.
`V3__payments_tickets_dispatch.sql` adds payment and ticket metadata plus
persisted dispatch manifests. For an existing installation, Flyway baselines
the pre-existing schema at version 0, then applies these additive migrations.
Install the base schema first. Existing
schedules receive a nullable duration: populate accurate historical durations
before publishing schedules for the same buses or drivers; unknown-duration
schedules conservatively block overlapping assignments. New schedules require
an explicit duration.

Set these environment variables before starting the API:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/transport"
$env:DB_USERNAME = "transport"
$env:DB_PASSWORD = "<your database password>"
$env:JWT_SECRET_BASE64 = [Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
)
$env:PAYMENT_WEBHOOK_SECRET = [Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
)
$env:TICKET_QR_SECRET_BASE64 = [Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
)
```

Keep the JWT and QR signing keys secret and stable across restarts; do not commit them.
For production, use a secrets manager, HTTPS/TLS, and a production PostgreSQL
account with only the privileges the API needs.

Run tests and start the API from this directory:

```powershell
mvn test
mvn spring-boot:run
```

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a passenger |
| `POST` | `/api/auth/login` | Public | Verify credentials and issue a JWT |
| `GET` | `/api/users/profile` | Authenticated | Fetch the caller's profile |
| `PATCH` | `/api/users/profile` | Authenticated | Update name, phone, or password |
| `PATCH` | `/api/admin/users/{userId}/role` | Admin | Assign a user's RBAC role |
| `GET` | `/api/fleet/buses` | Association Manager or Admin | List buses in the manager's association, or all buses for an Admin |
| `GET` | `/api/fleet/buses/{busId}` | Association Manager or Admin | Read an authorized bus |
| `POST` | `/api/fleet/buses` | Association Manager or Admin | Create a bus and its seat inventory |
| `PUT` | `/api/fleet/buses/{busId}` | Association Manager or Admin | Update a bus or assign/unassign its driver |
| `DELETE` | `/api/fleet/buses/{busId}` | Association Manager or Admin | Delete an unscheduled bus |
| `PUT` | `/api/admin/tariff` | Admin | Set the global base price per km |
| `GET` | `/api/admin/tariff` | Admin | Read the configured global base price per km |
| `GET` | `/api/routes/{routeId}/fare?busLevel=1` | Public | Calculate a route fare for bus level 1, 2, or 3 |
| `POST` | `/api/schedules` | Association Manager or Admin | Validate and publish a trip schedule |
| `GET` | `/api/schedules/search?sourceCityId=…&destinationCityId=…&date=YYYY-MM-DD` | Public | Find published trips with available seats; optional `busLevel=1`, `2`, or `3` |
| `GET` | `/api/locations/cities` | Public | List city IDs and names for passenger trip search |
| `GET` | `/api/schedules/{scheduleId}/seats` | Authenticated | View the seat grid with `AVAILABLE`, `OCCUPIED`, and `RESTRICTED` states |
| `POST` | `/api/bookings/lock-seats` | Passenger or Terminal Clerk | Atomically hold one to five seats for exactly 10 minutes |
| `GET` | `/api/bookings/{bookingId}/ticket` | Authenticated owner | Retrieve a paid booking's digital ticket |
| `POST` | `/api/webhooks/payments` | Provider secret | Accept a simulated successful Telebirr or CBE Birr callback and issue a signed ticket |
| `POST` | `/api/bookings/{bookingId}/mock-payment` | Passenger, demo only | Simulate a Telebirr or CBE Birr success for the authenticated passenger's active booking; enable only with `MOCK_PAYMENT_ENABLED=true` |
| `POST` | `/api/dispatch/verify-ticket` | Terminal Clerk | Verify a paid ticket QR code and check the passenger in |
| `POST` | `/api/dispatch/schedules/{scheduleId}/manifest` | Clerk, Association Manager, or Admin | Trigger manifest generation when capacity/departure criteria are met |
| `GET` | `/api/dispatch/schedules/{scheduleId}/manifest` | Clerk, Association Manager, or Admin | Read the generated manifest, including its ETA |

Registration only creates `PASSENGER` accounts. This prevents self-assignment
of clerk, manager, or administrator privileges. Admins promote accounts using
the role-management endpoint. Since that endpoint requires an existing admin,
bootstrap the first administrator through a trusted database administrator
connection after registering its account:

```sql
UPDATE users
SET role = 'ADMIN',
    token_version = token_version + 1
WHERE phone_number = '+251911223344';
```

Replace the example number with the canonical phone number of the trusted
account. The account must log in again after this change.

Phone numbers accept Ethiopian local `09xxxxxxxx` or international
`+2519xxxxxxxx` format and are stored canonically as `+2519xxxxxxxx`.
Passwords are BCrypt-hashed with cost 10 and limited to 72 UTF-8 bytes.
Passwords are never returned by the API.

## JWT and role policy

Send access tokens as `Authorization: Bearer <token>`. The signed token contains
the user ID, role, token version, issuer, and expiry; it contains no password or
other private profile data. Access tokens expire after 15 minutes by default.
Suspended accounts and tokens with an outdated role/password version are
rejected on each request.

Route configuration paths under `/api/routes/**` and `/api/route-config/**` are
restricted to `ADMIN`. `POST /api/tickets/{ticketId}/validate` is restricted to
`TERMINAL_CLERK`. Association, fleet, driver-roster, and schedule management
paths are restricted to `ASSOCIATION_MANAGER` and `ADMIN`. Other API paths
require authentication unless explicitly made public. Add endpoint-specific
rules before adding new controllers; do not rely on frontend visibility as an
access-control mechanism.

Association managers must have a row in `association_managers`; the API scopes
their fleet reads and writes to that association. When creating a bus, a manager
may omit `associationId` (the assigned association is used); an Admin must
provide it. Driver assignments are checked against the bus association. New
buses automatically receive numbered seats matching their capacity. Capacity
cannot be changed after a bus has schedules; buses with schedules cannot be
moved to another association or deleted. A bus level also cannot change after
scheduling, so existing trip fares remain consistent with the advertised bus
configuration.

Set the global tariff using `PUT /api/admin/tariff` with
`{"baseRatePerKm": 2.50}`. Fares use the project's formula:
`distanceKm × baseRatePerKm × levelMultiplier + 10.00 ETB terminal fee`,
rounded to two decimals. Multipliers are 1.30 for level 1, 1.15 for level 2,
and 1.00 for level 3. Scheduling is unavailable until an Admin configures the
base rate.

Fleet requests use the bus's physical seat capacity; `level` is the integer
`1`, `2`, or `3`. An Association Manager can create a bus without an
`associationId`; an Admin must supply it. Example manager request:

```json
{
  "plateNumber": "A12345",
  "sideNumber": "SW-04",
  "capacity": 45,
  "level": 1,
  "assignedDriverId": "00000000-0000-0000-0000-000000000001"
}
```

Publish a schedule with a future ISO-8601 `departureAt` and positive
`durationMinutes`, along with `busId`, `routeId`, and `driverId`. The API checks
that the bus and driver belong to the same association, the driver is assigned
to that bus when an assignment exists, and the route and bus exist. It
serializes scheduling attempts using PostgreSQL row locks on the bus and driver,
then rejects any overlapping active schedule for either resource. In the same
transaction, it persists the published schedule and initializes one schedule
seat-inventory row for every physical bus seat. Search accepts source and
destination city IDs and interprets `date` as a UTC calendar day; it returns
only future, published schedules that still have available or expired-lock
seats. Route records must already exist in the database before a fare can be
calculated or a schedule can be published.

## Seat selection and temporary holds

The seat grid shows physical seats with these visual states:

- `AVAILABLE`: may be locked by an authenticated Passenger or Terminal Clerk.
- `OCCUPIED`: already booked or currently locked by another checkout.
- `RESTRICTED`: administratively blocked from sale using `seats.is_restricted`.

Request a hold by sending the schedule ID and one to five unique seat IDs:

```http
POST /api/bookings/lock-seats
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "scheduleId": "00000000-0000-0000-0000-000000000001",
  "seatIds": [
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003"
  ]
}
```

The API locks the requested `schedule_seats` rows using PostgreSQL
`SELECT ... FOR UPDATE`, validates every seat before reserving any, then writes
the lock and a `HOLD`/`PENDING` booking record in one transaction. Seat IDs are
locked in a consistent order to reduce deadlocks. Expiry is calculated once by
the PostgreSQL database clock and set to precisely ten minutes after lock
acquisition; every seat in the same request shares that expiration. If any
requested seat is unavailable, the transaction fails without partially holding
the remaining seats. A successful response includes each booking ID and the
common `expiresAt`.

A background worker runs every five seconds by default and processes at most
100 expired locks per batch. It uses `FOR UPDATE SKIP LOCKED`, deletes the
expired unpaid `HOLD` booking records, and changes their seat inventory rows
back to `AVAILABLE` in one transaction. Multiple application instances can run
the worker without releasing the same seat concurrently. Expired locks are also
released opportunistically when another customer tries to reserve the same
seat. Adjust `BOOKING_EXPIRY_SWEEP_MS` and `BOOKING_EXPIRY_BATCH_SIZE` to tune
the worker.

## Payment, tickets, and dispatch

Configure `PAYMENT_WEBHOOK_SECRET` before accepting mock payment callbacks.
The webhook endpoint is public at the HTTP authentication layer but rejects
requests unless `X-Payment-Webhook-Secret` matches the configured secret. The
callback body contains `bookingId`, `provider` (`TELEBIRR` or `CBE_BIRR`),
`paymentReference`, `amount`, and `successful: true`. The server checks the
fare and active hold, then in one transaction locks the same schedule-seat row,
marks payment `PAID`, confirms the booking, changes the seat to `BOOKED`, and
stores a signed QR ticket payload. Repeated callbacks with the same provider
and payment reference return the existing payment confirmation. Failed
callbacks are not accepted by this mock-success endpoint. The passenger can
retrieve the QR using `GET /api/bookings/{bookingId}/ticket`, which only
returns paid tickets to their owner. Keep `TICKET_QR_SECRET_BASE64` stable
across restarts; if omitted, the key derived from `JWT_SECRET_BASE64` is used.

The Base64url-encoded, HMAC-signed QR payload (not encrypted) carries the
passenger name, physical seat number, trip schedule ID, booking ID, and a
unique nonce. Clerks scan it with
`POST /api/dispatch/verify-ticket`, sending `{"qrData":"<scanned string>"}`.
The API checks the signature and exact persisted ticket, requires payment to
be complete, and records a one-time check-in timestamp. Re-scanning an already
checked-in ticket returns a conflict.

The manifest workflow snapshots paid passengers and the assigned driver's
name, seat assignments, generation trigger, and ETA (`departureAt` plus the
published schedule duration). The dispatcher worker checks for the 80%
paid-capacity threshold and due departures every 30 seconds by default;
successful payments also check the threshold immediately. A unique manifest
per schedule makes generation idempotent. Authorized clerks, association
managers, and admins may also trigger generation when those criteria are met
or retrieve the stored snapshot. Tune `DISPATCH_MANIFEST_SWEEP_MS` and
`DISPATCH_MANIFEST_BATCH_SIZE` for deployment needs.

The mobile demo checkout uses the separate passenger-authenticated
`/api/bookings/{bookingId}/mock-payment` endpoint. It accepts only the booking
owner's active hold and generates the mock provider reference on the server;
the webhook secret is never sent to or stored by the client. This endpoint is
disabled by default. Set `MOCK_PAYMENT_ENABLED=true` only for local/demo
deployments; it simulates payment without charging a real account.

Changing a password or role increments `token_version`, invalidating existing
tokens. A password update requires the user to log in again. JWTs are signed
(not encrypted); clients must not put secrets in token claims and must use
HTTPS in deployment.
