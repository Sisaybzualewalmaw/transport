CREATE TABLE system_tariff (
    id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    base_rate_per_km    numeric(12, 2) NOT NULL CHECK (base_rate_per_km > 0),
    updated_by          uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE buses
    ADD COLUMN assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;

ALTER TABLE schedules
    ADD COLUMN duration_minutes integer CHECK (duration_minutes > 0);
