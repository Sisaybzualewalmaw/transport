package com.woldia.transport.booking;

import com.woldia.transport.auth.AccountPrincipal;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class BookingController {
    private final BookingService bookings;

    public BookingController(BookingService bookings) {
        this.bookings = bookings;
    }

    @GetMapping("/schedules/{scheduleId}/seats")
    public SeatMapResponse getSeatMap(@PathVariable UUID scheduleId) {
        return bookings.getSeatMap(scheduleId);
    }

    @PostMapping("/bookings/lock-seats")
    public LockSeatsResponse lockSeats(
            @AuthenticationPrincipal AccountPrincipal principal,
            @Valid @RequestBody LockSeatsRequest request
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
        return bookings.lockSeats(principal.getId(), request);
    }
}
