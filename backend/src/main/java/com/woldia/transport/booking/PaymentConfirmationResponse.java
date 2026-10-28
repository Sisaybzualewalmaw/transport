package com.woldia.transport.booking;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PaymentConfirmationResponse(
        UUID bookingId,
        String paymentStatus,
        BigDecimal amount,
        OffsetDateTime paidAt
) {
}
