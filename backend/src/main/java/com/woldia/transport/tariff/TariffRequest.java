package com.woldia.transport.tariff;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record TariffRequest(
        @NotNull
        @DecimalMin(value = "0.01")
        @DecimalMax(value = "100000.00")
        BigDecimal baseRatePerKm
) {
}
