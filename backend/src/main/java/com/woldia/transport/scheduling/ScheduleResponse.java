package com.woldia.transport.scheduling;

import com.woldia.transport.fleet.Bus;
import com.woldia.transport.fleet.Driver;
import com.woldia.transport.routing.Route;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ScheduleResponse(
        UUID id,
        UUID busId,
        String plateNumber,
        short busLevel,
        UUID routeId,
        String sourceCity,
        String sourceTerminal,
        String destinationCity,
        String destinationTerminal,
        UUID driverId,
        String driverName,
        OffsetDateTime departureAt,
        Integer durationMinutes,
        BigDecimal price,
        int availableSeats,
        ScheduleStatus status
) {
    public static ScheduleResponse from(Schedule schedule, int availableSeats) {
        Bus bus = schedule.getBus();
        Route route = schedule.getRoute();
        Driver driver = schedule.getDriver();
        return new ScheduleResponse(
                schedule.getId(),
                bus.getId(),
                bus.getPlateNumber(),
                bus.getLevel(),
                route.getId(),
                route.getOriginTerminal().getCity().getName(),
                route.getOriginTerminal().getName(),
                route.getDestinationTerminal().getCity().getName(),
                route.getDestinationTerminal().getName(),
                driver.getId(),
                driver.getUser().getFullName(),
                schedule.getDepartureAt(),
                schedule.getDurationMinutes(),
                schedule.getPrice(),
                availableSeats,
                schedule.getStatus()
        );
    }
}
