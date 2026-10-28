ALTER TABLE bookings
    ADD COLUMN payment_provider text,
    ADD COLUMN payment_reference text,
    ADD COLUMN paid_at timestamptz,
    ADD COLUMN ticket_qr_data text,
    ADD COLUMN checked_in_at timestamptz;

CREATE UNIQUE INDEX bookings_payment_reference_key
    ON bookings (payment_provider, payment_reference)
    WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX bookings_ticket_qr_data_key
    ON bookings (ticket_qr_data)
    WHERE ticket_qr_data IS NOT NULL;

CREATE TABLE dispatch_manifests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id uuid NOT NULL UNIQUE REFERENCES schedules(id) ON DELETE CASCADE,
    trigger_type text NOT NULL CHECK (
        trigger_type IN ('CAPACITY_THRESHOLD', 'DEPARTURE')
    ),
    generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    estimated_arrival_at timestamptz NOT NULL,
    driver_name text NOT NULL,
    generated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE dispatch_manifest_passengers (
    manifest_id uuid NOT NULL REFERENCES dispatch_manifests(id) ON DELETE CASCADE,
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    passenger_name text NOT NULL,
    seat_number integer NOT NULL,
    seat_label text,
    PRIMARY KEY (manifest_id, booking_id),
    UNIQUE (manifest_id, seat_number)
);

CREATE INDEX dispatch_manifests_generated_at_idx
    ON dispatch_manifests (generated_at DESC);
