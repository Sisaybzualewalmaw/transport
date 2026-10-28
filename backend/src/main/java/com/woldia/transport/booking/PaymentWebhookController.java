package com.woldia.transport.booking;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/webhooks/payments")
public class PaymentWebhookController {
    private final PaymentService payments;

    public PaymentWebhookController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping
    public PaymentConfirmationResponse receivePayment(
            @RequestHeader(name = "X-Payment-Webhook-Secret", required = false)
            String webhookSecret,
            @Valid @RequestBody PaymentCallbackRequest request
    ) {
        payments.authorizeWebhook(webhookSecret);
        return payments.handleSuccessfulCallback(request);
    }
}
