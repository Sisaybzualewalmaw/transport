package com.woldia.transport.scheduling;

import com.woldia.transport.fleet.Bus;
import com.woldia.transport.fleet.BusRepository;
import com.woldia.transport.fleet.BusStatus;
import com.woldia.transport.fleet.Driver;
import com.woldia.transport.fleet.DriverRepository;
import com.woldia.transport.routing.Route;
import com.woldia.transport.routing.RouteRepository;
import com.woldia.transport.tariff.SystemTariff;
import com.woldia.transport.tariff.TariffService;
import com.woldia.transport.user.AssociationManagerRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ScheduleService {
    private final ScheduleRepository schedules;
    private final BusRepository buses;
    private final DriverRepository drivers;
    private final RouteRepository routes;
    private final AssociationManagerRepository managers;
    private final TariffService tariffs;
    private final JdbcTemplate jdbc;

    public ScheduleService(
            ScheduleRepository schedules,
            BusRepository buses,
            DriverRepository drivers,
            RouteRepository routes,
            AssociationManagerRepository managers,
            TariffService tariffs,
            JdbcTemplate jdbc
    ) {
        this.schedules = schedules;
        this.buses = buses;
        this.drivers = drivers;
        this.routes = routes;
        this.managers = managers;
        this.tariffs = tariffs;
        this.jdbc = jdbc;
    }

    @Transactional
    public ScheduleResponse publish(
            UUID userId,
            List<GrantedAuthority> authorities,
            PublishScheduleRequest request
    ) {
        UUID busLock = buses.lockForScheduling(request.busId());
        if (busLock == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bus not found.");
        }
        UUID driverLock = drivers.lockForScheduling(request.driverId());
        if (driverLock == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found.");
        }

        Bus bus = buses.findById(request.busId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bus not found."));
        Driver driver = drivers.findDetailedById(request.driverId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));
        Route route = routes.findDetailedById(request.routeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found."));

        authorizeAssociation(userId, authorities, bus.getAssociationId());
        if (!bus.getAssociationId().equals(driver.getAssociationId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "The bus and driver must belong to the same association."
            );
        }
        if (bus.getStatus() != BusStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only active buses can be scheduled.");
        }
        if (bus.getAssignedDriver() != null
                && !bus.getAssignedDriver().getId().equals(driver.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "The selected driver is not assigned to this bus."
            );
        }

        OffsetDateTime startAt = request.departureAt().withOffsetSameInstant(ZoneOffset.UTC);
        OffsetDateTime endAt = startAt.plusMinutes(request.durationMinutes());
        if (schedules.hasOverlappingSchedule(bus.getId(), driver.getId(), startAt, endAt)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The bus or driver already has a schedule that overlaps this trip."
            );
        }

        Integer seatCount = jdbc.queryForObject(
                "select count(*) from seats where bus_id = ?",
                Integer.class,
                bus.getId()
        );
        if (seatCount == null || seatCount != bus.getCapacity()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bus seat inventory must match its registered capacity before scheduling."
            );
        }

        SystemTariff tariff = tariffs.getTariff();
        var price = TariffService.calculateTotalFare(
                route.getDistanceKm(),
                tariff.getBaseRatePerKm(),
                bus.getLevel()
        );
        Schedule schedule = schedules.saveAndFlush(new Schedule(
                bus,
                route,
                driver,
                startAt,
                request.durationMinutes(),
                price
        ));

        int inventoryRows = jdbc.update(
                """
                insert into schedule_seats (schedule_id, bus_id, seat_id, status)
                select ?, bus_id, id, 'AVAILABLE'::seat_status
                from seats
                where bus_id = ?
                """,
                schedule.getId(),
                bus.getId()
        );
        if (inventoryRows != bus.getCapacity()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Could not initialize the complete seat inventory for this schedule."
            );
        }

        return ScheduleResponse.from(schedule, inventoryRows);
    }

    @Transactional(readOnly = true)
    public List<ScheduleResponse> search(
            UUID sourceCityId,
            UUID destinationCityId,
            LocalDate date,
            Integer busLevel
    ) {
        if (sourceCityId.equals(destinationCityId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Source and destination cities must be different."
            );
        }
        if (busLevel != null && (busLevel < 1 || busLevel > 3)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bus level must be 1, 2, or 3.");
        }

        OffsetDateTime dayStart = date.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime startAt = dayStart.isAfter(OffsetDateTime.now(ZoneOffset.UTC))
                ? dayStart
                : OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime endAt = date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
        Short level = busLevel == null ? null : busLevel.shortValue();
        return schedules.searchPublished(
                        sourceCityId,
                        destinationCityId,
                        startAt,
                        endAt,
                        level
                )
                .stream()
                .map(schedule -> {
                    Integer available = jdbc.queryForObject(
                            """
                            select count(*)
                            from schedule_seats ss
                            join seats seat on seat.id = ss.seat_id
                            where ss.schedule_id = ?
                              and not seat.is_restricted
                              and (ss.status = 'AVAILABLE'
                                   or (ss.status = 'LOCKED' and ss.lock_expires_at <= clock_timestamp()))
                            """,
                            Integer.class,
                            schedule.getId()
                    );
                    return ScheduleResponse.from(schedule, available == null ? 0 : available);
                })
                .filter(schedule -> schedule.availableSeats() > 0)
                .toList();
    }

    private void authorizeAssociation(
            UUID userId,
            List<GrantedAuthority> authorities,
            UUID associationId
    ) {
        boolean isAdmin = authorities.stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
        if (isAdmin) {
            return;
        }

        UUID managerAssociation = managers.findByUserId(userId)
                .map(manager -> manager.getAssociationId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "No association is assigned to this manager."
                ));
        if (!managerAssociation.equals(associationId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Association managers may only schedule their own fleet."
            );
        }
    }
}
