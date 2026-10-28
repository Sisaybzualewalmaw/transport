package com.woldia.transport.booking;

import java.util.UUID;

public record SeatMapItem(
        UUID seatId,
        int seatNumber,
        String seatLabel,
        SeatLockState status
) {
}
