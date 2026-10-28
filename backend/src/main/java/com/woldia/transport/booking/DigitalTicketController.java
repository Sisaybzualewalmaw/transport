package com.woldia.transport.booking;

import com.woldia.transport.auth.AccountPrincipal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/bookings")
public class DigitalTicketController {
    private final DigitalTicketService tickets;

    public DigitalTicketController(DigitalTicketService tickets) {
        this.tickets = tickets;
    }

    @GetMapping("/{bookingId}/ticket")
    public DigitalTicketResponse getTicket(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal AccountPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required."
            );
        }
        return tickets.getTicket(bookingId, principal.getId());
    }
}
