package com.woldia.transport.tariff;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import com.woldia.transport.routing.Route;
import com.woldia.transport.routing.RouteRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TariffServiceTest {
    @Mock
    private SystemTariffRepository tariffs;

    @Mock
    private RouteRepository routes;

    @Mock
    private Route route;

    @Test
    void calculatesFareUsingDistanceLevelMultiplierAndTerminalFee() {
        UUID routeId = UUID.randomUUID();
        when(routes.findDetailedById(routeId)).thenReturn(Optional.of(route));
        when(route.getDistanceKm()).thenReturn(new BigDecimal("100.00"));
        when(route.getId()).thenReturn(routeId);
        when(tariffs.findById((short) 1)).thenReturn(Optional.of(
                new SystemTariff(new BigDecimal("2.00"), UUID.randomUUID())
        ));

        FareResponse fare = new TariffService(tariffs, routes).calculateFare(routeId, 2);

        assertEquals(new BigDecimal("200.00"), fare.baseRouteFare());
        assertEquals(new BigDecimal("1.15"), fare.levelMultiplier());
        assertEquals(new BigDecimal("10.00"), fare.terminalFee());
        assertEquals(new BigDecimal("240.00"), fare.totalFare());
    }

    @Test
    void calculatesLevelOneAndThreeWithProjectMultipliers() {
        assertEquals(
                new BigDecimal("140.00"),
                TariffService.calculateTotalFare(
                        new BigDecimal("100.00"),
                        BigDecimal.ONE,
                        (short) 1
                )
        );
        assertEquals(
                new BigDecimal("110.00"),
                TariffService.calculateTotalFare(
                        new BigDecimal("100.00"),
                        BigDecimal.ONE,
                        (short) 3
                )
        );
    }
}
