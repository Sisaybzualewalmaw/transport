package com.woldia.transport.booking;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ExpiredSeatLockWorker {
    private final BookingService bookings;
    private final int batchSize;

    public ExpiredSeatLockWorker(
            BookingService bookings,
            @Value("${app.booking.expiry-batch-size:100}") int batchSize
    ) {
        if (batchSize < 1 || batchSize > 1000) {
            throw new IllegalArgumentException("Booking expiry batch size must be between 1 and 1000.");
        }
        this.bookings = bookings;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${app.booking.expiry-sweep-ms:5000}")
    public void releaseExpiredLocks() {
        bookings.releaseExpiredLocks(batchSize);
    }
}
