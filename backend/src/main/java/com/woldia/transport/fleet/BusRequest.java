package com.woldia.transport.fleet;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record BusRequest(
        UUID associationId,

        @NotBlank
        @Size(max = 30)
        String plateNumber,

        @NotBlank
        @Size(max = 30)
        String sideNumber,

        @Positive
        @Max(200)
        int capacity,

        @Min(1)
        @Max(3)
        int level,

        UUID assignedDriverId,

        BusStatus status
) {
}
