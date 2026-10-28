package com.woldia.transport.dispatch;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record DispatchManifestResponse(
        UUID manifestId,
        UUID scheduleId,
        String triggerType,
        OffsetDateTime generatedAt,
        OffsetDateTime estimatedArrivalAt,
        String driverName,
        List<ManifestPassenger> passengers
) {
    public record ManifestPassenger(
            UUID bookingId,
            String passengerName,
            int seatNumber,
            String seatLabel
    ) {
    }
}
