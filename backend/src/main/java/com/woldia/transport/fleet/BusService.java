package com.woldia.transport.fleet;

import com.woldia.transport.scheduling.ScheduleRepository;
import com.woldia.transport.user.AssociationManagerRepository;
import com.woldia.transport.user.UserRole;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BusService {
    private final BusRepository buses;
    private final DriverRepository drivers;
    private final AssociationManagerRepository managers;
    private final ScheduleRepository schedules;
    private final JdbcTemplate jdbc;

    public BusService(
            BusRepository buses,
            DriverRepository drivers,
            AssociationManagerRepository managers,
            ScheduleRepository schedules,
            JdbcTemplate jdbc
    ) {
        this.buses = buses;
        this.drivers = drivers;
        this.managers = managers;
        this.schedules = schedules;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<BusResponse> listBuses(UUID userId, List<GrantedAuthority> authorities) {
        boolean isAdmin = hasRole(authorities, UserRole.ADMIN);
        if (isAdmin) {
            return buses.findAll().stream().map(BusResponse::from).toList();
        }
        UUID associationId = requireManagerAssociation(userId);
        return buses.findAllByAssociationId(associationId).stream().map(BusResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public BusResponse getBus(
            UUID userId,
            List<GrantedAuthority> authorities,
            UUID busId
    ) {
        Bus bus = buses.findDetailedById(busId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bus not found."));
        authorizeAssociation(userId, authorities, bus.getAssociationId());
        return BusResponse.from(bus);
    }

    @Transactional
    public BusResponse createBus(
            UUID userId,
            List<GrantedAuthority> authorities,
            BusRequest request
    ) {
        UUID associationId = resolveAssociation(userId, authorities, request.associationId());
        Bus bus = new Bus(
                associationId,
                normalize(request.plateNumber()),
                normalize(request.sideNumber()),
                request.capacity(),
                (short) request.level()
        );
        bus.setStatus(request.status() == null ? BusStatus.ACTIVE : request.status());
        bus.setAssignedDriver(resolveDriver(request.assignedDriverId(), associationId));
        bus = buses.saveAndFlush(bus);
        createSeats(bus);
        return BusResponse.from(buses.findDetailedById(bus.getId()).orElseThrow());
    }

    @Transactional
    public BusResponse updateBus(
            UUID userId,
            List<GrantedAuthority> authorities,
            UUID busId,
            BusRequest request
    ) {
        if (buses.lockForScheduling(busId) == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bus not found.");
        }
        Bus bus = buses.findDetailedById(busId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bus not found."));
        authorizeAssociation(userId, authorities, bus.getAssociationId());

        UUID associationId = bus.getAssociationId();
        if (request.associationId() != null && !request.associationId().equals(associationId)) {
            requireAdmin(authorities);
            if (schedules.existsByBus_Id(busId)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "A bus with schedules cannot be moved to another association."
                );
            }
            associationId = request.associationId();
            requireAssociationExists(associationId);
        }

        if ((request.capacity() != bus.getCapacity() || request.level() != bus.getLevel())
                && schedules.existsByBus_Id(busId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bus capacity and level cannot change after a schedule has been created."
            );
        }

        bus.setAssociationId(associationId);
        bus.setPlateNumber(normalize(request.plateNumber()));
        bus.setSideNumber(normalize(request.sideNumber()));
        bus.setCapacity(request.capacity());
        bus.setLevel((short) request.level());
        if (request.status() != null) {
            bus.setStatus(request.status());
        }
        bus.setAssignedDriver(resolveDriver(request.assignedDriverId(), associationId));
        bus = buses.saveAndFlush(bus);
        synchronizeSeats(bus);
        return BusResponse.from(buses.findDetailedById(bus.getId()).orElseThrow());
    }

    @Transactional
    public void deleteBus(UUID userId, List<GrantedAuthority> authorities, UUID busId) {
        if (buses.lockForScheduling(busId) == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bus not found.");
        }
        Bus bus = buses.findById(busId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bus not found."));
        authorizeAssociation(userId, authorities, bus.getAssociationId());
        if (schedules.existsByBus_Id(busId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A bus with schedules cannot be deleted."
            );
        }
        jdbc.update("delete from seats where bus_id = ?", busId);
        buses.delete(bus);
    }

    private UUID resolveAssociation(
            UUID userId,
            List<GrantedAuthority> authorities,
            UUID requestedAssociationId
    ) {
        if (hasRole(authorities, UserRole.ADMIN)) {
            if (requestedAssociationId == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Admin must provide an associationId."
                );
            }
            requireAssociationExists(requestedAssociationId);
            return requestedAssociationId;
        }

        UUID managerAssociationId = requireManagerAssociation(userId);
        if (requestedAssociationId != null && !requestedAssociationId.equals(managerAssociationId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Association managers may only manage their assigned association."
            );
        }
        return managerAssociationId;
    }

    private UUID requireManagerAssociation(UUID userId) {
        return managers.findByUserId(userId)
                .map(manager -> {
                    try {
                        return jdbc.queryForObject(
                                "select id from associations where id = ?",
                                UUID.class,
                                manager.getAssociationId()
                        );
                    } catch (EmptyResultDataAccessException exception) {
                        throw new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "No active association is assigned to this manager."
                        );
                    }
                })
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "No association is assigned to this manager."
                ));
    }

    private void authorizeAssociation(
            UUID userId,
            List<GrantedAuthority> authorities,
            UUID associationId
    ) {
        if (hasRole(authorities, UserRole.ADMIN)) {
            return;
        }
        if (!requireManagerAssociation(userId).equals(associationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access to this association is denied.");
        }
    }

    private static void requireAdmin(List<GrantedAuthority> authorities) {
        if (!hasRole(authorities, UserRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins may change bus associations.");
        }
    }

    private static boolean hasRole(List<GrantedAuthority> authorities, UserRole role) {
        String expected = "ROLE_" + role.name();
        return authorities.stream().anyMatch(authority -> expected.equals(authority.getAuthority()));
    }

    private void requireAssociationExists(UUID associationId) {
        try {
            jdbc.queryForObject("select id from associations where id = ?", UUID.class, associationId);
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Association not found.");
        }
    }

    private Driver resolveDriver(UUID driverId, UUID associationId) {
        if (driverId == null) {
            return null;
        }
        Driver driver = drivers.findDetailedById(driverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));
        if (!driver.getAssociationId().equals(associationId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "The assigned driver must belong to the bus association."
            );
        }
        return driver;
    }

    private void createSeats(Bus bus) {
        for (int seatNumber = 1; seatNumber <= bus.getCapacity(); seatNumber++) {
            jdbc.update(
                    "insert into seats (id, bus_id, seat_number, seat_label) values (gen_random_uuid(), ?, ?, ?)",
                    bus.getId(),
                    seatNumber,
                    Integer.toString(seatNumber)
            );
        }
    }

    private void synchronizeSeats(Bus bus) {
        int currentSeats = jdbc.queryForObject(
                "select count(*) from seats where bus_id = ?",
                Integer.class,
                bus.getId()
        );
        if (currentSeats > bus.getCapacity()) {
            jdbc.update(
                    "delete from seats where bus_id = ? and seat_number > ?",
                    bus.getId(),
                    bus.getCapacity()
            );
        } else {
            for (int seatNumber = currentSeats + 1; seatNumber <= bus.getCapacity(); seatNumber++) {
                jdbc.update(
                        "insert into seats (id, bus_id, seat_number, seat_label) values (gen_random_uuid(), ?, ?, ?)",
                        bus.getId(),
                        seatNumber,
                        Integer.toString(seatNumber)
                );
            }
        }
    }

    private static String normalize(String value) {
        return value.trim().toUpperCase(java.util.Locale.ROOT);
    }
}
