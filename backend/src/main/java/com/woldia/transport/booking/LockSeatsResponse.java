package com.woldia.transport.booking;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record LockSeatsResponse(
        UUID scheduleId,
        OffsetDateTime expiresAt,
        List<LockedSeatResponse> seats
) {
}
