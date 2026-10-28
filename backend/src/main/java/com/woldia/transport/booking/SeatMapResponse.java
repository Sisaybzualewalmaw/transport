package com.woldia.transport.booking;

import java.util.List;
import java.util.UUID;

public record SeatMapResponse(
        UUID scheduleId,
        List<SeatMapItem> seats
) {
}
