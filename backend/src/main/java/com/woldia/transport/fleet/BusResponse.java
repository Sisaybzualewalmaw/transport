package com.woldia.transport.fleet;

import java.util.UUID;

public record BusResponse(
        UUID id,
        UUID associationId,
        String plateNumber,
        String sideNumber,
        int capacity,
        short level,
        BusStatus status,
        UUID assignedDriverId,
        String assignedDriverName
) {
    public static BusResponse from(Bus bus) {
        Driver driver = bus.getAssignedDriver();
        return new BusResponse(
                bus.getId(),
                bus.getAssociationId(),
                bus.getPlateNumber(),
                bus.getSideNumber(),
                bus.getCapacity(),
                bus.getLevel(),
                bus.getStatus(),
                driver == null ? null : driver.getId(),
                driver == null ? null : driver.getUser().getFullName()
        );
    }
}
