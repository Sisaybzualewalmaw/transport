package com.woldia.transport.tariff;

import com.woldia.transport.routing.Route;
import com.woldia.transport.routing.RouteRepository;
import com.woldia.transport.user.UserAccount;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TariffService {
    private static final short SINGLETON_ID = 1;
    private static final BigDecimal TERMINAL_FEE = new BigDecimal("10.00");
    private static final BigDecimal[] LEVEL_MULTIPLIERS = {
            BigDecimal.ZERO,
            new BigDecimal("1.30"),
            new BigDecimal("1.15"),
            new BigDecimal("1.00")
    };

    private final SystemTariffRepository tariffs;
    private final RouteRepository routes;

    public TariffService(SystemTariffRepository tariffs, RouteRepository routes) {
        this.tariffs = tariffs;
        this.routes = routes;
    }

    @Transactional(readOnly = true)
    public SystemTariff getTariff() {
        return tariffs.findById(SINGLETON_ID)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "The system base rate has not been configured."
                ));
    }

    @Transactional
    public SystemTariff updateTariff(BigDecimal baseRatePerKm, UserAccount admin) {
        if (baseRatePerKm == null || baseRatePerKm.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Base rate must be positive.");
        }

        SystemTariff tariff = tariffs.findById(SINGLETON_ID)
                .orElseGet(() -> new SystemTariff(baseRatePerKm, admin.getId()));
        tariff.update(baseRatePerKm, admin.getId());
        tariff = tariffs.save(tariff);
        return tariff;
    }

    @Transactional(readOnly = true)
    public FareResponse calculateFare(UUID routeId, int busLevel) {
        if (busLevel < 1 || busLevel > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bus level must be 1, 2, or 3.");
        }

        Route route = routes.findDetailedById(routeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found."));
        SystemTariff tariff = getTariff();
        BigDecimal multiplier = LEVEL_MULTIPLIERS[busLevel];
        BigDecimal baseFare = route.getDistanceKm()
                .multiply(tariff.getBaseRatePerKm())
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalFare = calculateTotalFare(
                route.getDistanceKm(),
                tariff.getBaseRatePerKm(),
                (short) busLevel
        );

        return new FareResponse(
                route.getId(),
                route.getDistanceKm(),
                tariff.getBaseRatePerKm(),
                baseFare,
                (short) busLevel,
                multiplier,
                TERMINAL_FEE,
                totalFare
        );
    }

    public static BigDecimal getMultiplier(short level) {
        if (level < 1 || level > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bus level must be 1, 2, or 3.");
        }
        return LEVEL_MULTIPLIERS[level];
    }

    public static BigDecimal getTerminalFee() {
        return TERMINAL_FEE;
    }

    public static BigDecimal calculateTotalFare(
            BigDecimal distanceKm,
            BigDecimal baseRatePerKm,
            short level
    ) {
        return distanceKm.multiply(baseRatePerKm)
                .multiply(getMultiplier(level))
                .add(TERMINAL_FEE)
                .setScale(2, RoundingMode.HALF_UP);
    }
}
