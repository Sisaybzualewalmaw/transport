package com.woldia.transport.scheduling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.woldia.transport.fleet.Bus;
import com.woldia.transport.fleet.BusRepository;
import com.woldia.transport.fleet.BusStatus;
import com.woldia.transport.fleet.Driver;
import com.woldia.transport.fleet.DriverRepository;
import com.woldia.transport.routing.Route;
import com.woldia.transport.routing.RouteRepository;
import com.woldia.transport.tariff.TariffService;
import com.woldia.transport.user.AssociationManager;
import com.woldia.transport.user.AssociationManagerRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ScheduleServiceTest {
    @Mock
    private ScheduleRepository schedules;

    @Mock
    private BusRepository buses;

    @Mock
    private DriverRepository drivers;

    @Mock
    private RouteRepository routes;

    @Mock
    private AssociationManagerRepository managers;

    @Mock
    private TariffService tariffs;

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private Bus bus;

    @Mock
    private Driver driver;

    @Mock
    private Route route;

    @Test
    void rejectsOverlappingBusOrDriverSchedulesBeforePublishing() {
        UUID userId = UUID.randomUUID();
        UUID associationId = UUID.randomUUID();
        UUID busId = UUID.randomUUID();
        UUID driverId = UUID.randomUUID();
        UUID routeId = UUID.randomUUID();
        OffsetDateTime departure = OffsetDateTime.now().plusDays(1);

        when(buses.lockForScheduling(busId)).thenReturn(busId);
        when(drivers.lockForScheduling(driverId)).thenReturn(driverId);
        when(buses.findById(busId)).thenReturn(Optional.of(bus));
        when(drivers.findDetailedById(driverId)).thenReturn(Optional.of(driver));
        when(routes.findDetailedById(routeId)).thenReturn(Optional.of(route));
        when(bus.getId()).thenReturn(busId);
        when(bus.getAssociationId()).thenReturn(associationId);
        when(bus.getStatus()).thenReturn(BusStatus.ACTIVE);
        when(bus.getAssignedDriver()).thenReturn(null);
        when(driver.getId()).thenReturn(driverId);
        when(driver.getAssociationId()).thenReturn(associationId);
        when(managers.findByUserId(userId))
                .thenReturn(Optional.of(new AssociationManager(userId, associationId)));
        when(schedules.hasOverlappingSchedule(
                busId,
                driverId,
                departure.withOffsetSameInstant(java.time.ZoneOffset.UTC),
                departure.withOffsetSameInstant(java.time.ZoneOffset.UTC).plusMinutes(120)
        )).thenReturn(true);

        ScheduleService service = new ScheduleService(
                schedules,
                buses,
                drivers,
                routes,
                managers,
                tariffs,
                jdbc
        );
        PublishScheduleRequest request = new PublishScheduleRequest(
                busId,
                routeId,
                driverId,
                departure,
                120
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.publish(
                        userId,
                        List.of(new SimpleGrantedAuthority("ROLE_ASSOCIATION_MANAGER")),
                        request
                )
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        InOrder lockOrder = inOrder(buses, drivers);
        lockOrder.verify(buses).lockForScheduling(busId);
        lockOrder.verify(drivers).lockForScheduling(driverId);
        verify(schedules, never()).saveAndFlush(org.mockito.ArgumentMatchers.any(Schedule.class));
    }
}
