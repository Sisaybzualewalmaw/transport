package com.woldia.transport.booking;

import com.woldia.transport.auth.AccountPrincipal;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/bookings")
public class MockPaymentController {
    private final PaymentService payments;

    public MockPaymentController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping("/{bookingId}/mock-payment")
    public PaymentConfirmationResponse simulatePayment(
            @AuthenticationPrincipal AccountPrincipal principal,
            @PathVariable UUID bookingId,
            @Valid @RequestBody MockPaymentRequest request
    ) {
        if (principal == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required."
            );
        }
        return payments.simulateSuccessfulPayment(
                bookingId,
                principal.getId(),
                request.provider()
        );
    }
}
