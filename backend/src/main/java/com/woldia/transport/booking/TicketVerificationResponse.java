package com.woldia.transport.booking;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TicketVerificationResponse(
        UUID bookingId,
        UUID scheduleId,
        String status,
        String passengerName,
        int seatNumber,
        String seatLabel,
        OffsetDateTime checkedInAt
) {
}
