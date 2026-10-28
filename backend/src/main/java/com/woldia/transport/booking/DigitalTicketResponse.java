package com.woldia.transport.booking;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DigitalTicketResponse(
        UUID bookingId,
        UUID scheduleId,
        String passengerName,
        int seatNumber,
        String seatLabel,
        String paymentStatus,
        OffsetDateTime paidAt,
        String qrData
) {
}
