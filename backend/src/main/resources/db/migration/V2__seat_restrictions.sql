ALTER TABLE seats
    ADD COLUMN is_restricted boolean NOT NULL DEFAULT false;

CREATE INDEX schedule_seats_expiring_locks_idx
    ON schedule_seats (lock_expires_at)
    WHERE status = 'LOCKED';

CREATE INDEX bookings_expiring_holds_idx
    ON bookings (hold_expires_at)
    WHERE booking_state = 'HOLD';
