package com.woldia.transport.tariff;

import java.math.BigDecimal;
import java.util.UUID;

public record FareResponse(
        UUID routeId,
        BigDecimal distanceKm,
        BigDecimal baseRatePerKm,
        BigDecimal baseRouteFare,
        short busLevel,
        BigDecimal levelMultiplier,
        BigDecimal terminalFee,
        BigDecimal totalFare
) {
}
