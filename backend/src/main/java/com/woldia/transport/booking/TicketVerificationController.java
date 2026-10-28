package com.woldia.transport.booking;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dispatch")
public class TicketVerificationController {
    private final TicketVerificationService tickets;

    public TicketVerificationController(TicketVerificationService tickets) {
        this.tickets = tickets;
    }

    @PostMapping("/verify-ticket")
    public TicketVerificationResponse verifyTicket(
            @Valid @RequestBody TicketVerificationRequest request
    ) {
        return tickets.verify(request.qrData());
    }
}
