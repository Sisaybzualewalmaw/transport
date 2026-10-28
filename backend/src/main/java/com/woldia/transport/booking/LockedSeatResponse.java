package com.woldia.transport.booking;

import java.time.OffsetDateTime;
import java.util.UUID;

public record LockedSeatResponse(
        UUID bookingId,
        UUID seatId,
        OffsetDateTime expiresAt
) {
}
