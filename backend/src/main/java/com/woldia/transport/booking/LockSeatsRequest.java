package com.woldia.transport.booking;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record LockSeatsRequest(
        @NotNull UUID scheduleId,
        @NotEmpty @Size(max = 5) List<@NotNull UUID> seatIds
) {
}
