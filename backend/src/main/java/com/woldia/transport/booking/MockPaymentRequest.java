package com.woldia.transport.booking;

import jakarta.validation.constraints.NotNull;

public record MockPaymentRequest(@NotNull PaymentProvider provider) {
}
