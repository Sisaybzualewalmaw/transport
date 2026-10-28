package com.woldia.transport.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TicketVerificationRequest(
        @NotBlank @Size(max = 4096) String qrData
) {
}
