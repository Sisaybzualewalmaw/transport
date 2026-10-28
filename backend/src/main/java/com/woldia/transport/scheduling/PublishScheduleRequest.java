package com.woldia.transport.scheduling;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PublishScheduleRequest(
        @NotNull UUID busId,
        @NotNull UUID routeId,
        @NotNull UUID driverId,
        @NotNull @Future OffsetDateTime departureAt,
        @Positive @Min(1) @Max(1440) int durationMinutes
) {
}
