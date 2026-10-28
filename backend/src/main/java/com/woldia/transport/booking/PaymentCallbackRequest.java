package com.woldia.transport.booking;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record PaymentCallbackRequest(
        @NotNull UUID bookingId,
        @NotNull PaymentProvider provider,
        @NotBlank @Size(max = 128) String paymentReference,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotNull Boolean successful
) {
}
