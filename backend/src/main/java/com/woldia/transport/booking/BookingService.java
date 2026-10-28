package com.woldia.transport.booking;

import com.woldia.transport.scheduling.Schedule;
import com.woldia.transport.scheduling.ScheduleRepository;
import com.woldia.transport.scheduling.ScheduleStatus;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookingService {
    private static final int MAX_SEATS_PER_LOCK = 5;

    private final ScheduleRepository schedules;
    private final SeatInventoryRepository seatInventory;

    public BookingService(
            ScheduleRepository schedules,
            SeatInventoryRepository seatInventory
    ) {
        this.schedules = schedules;
        this.seatInventory = seatInventory;
    }

    @Transactional(readOnly = true)
    public SeatMapResponse getSeatMap(UUID scheduleId) {
        Schedule schedule = schedules.findById(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Schedule not found."
                ));
        if (schedule.getStatus() != ScheduleStatus.PUBLISHED
                || !schedule.getDepartureAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Seat selection is only available for an upcoming published schedule."
            );
        }
        return new SeatMapResponse(scheduleId, seatInventory.findSeatMap(scheduleId));
    }

    @Transactional
    public LockSeatsResponse lockSeats(UUID userId, LockSeatsRequest request) {
        if (request.seatIds().size() > MAX_SEATS_PER_LOCK) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No more than five seats can be locked in one request."
            );
        }
        if (new HashSet<>(request.seatIds()).size() != request.seatIds().size()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "The request contains duplicate seat IDs."
            );
        }

        Schedule schedule = schedules.findById(request.scheduleId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Schedule not found."
                ));
        if (schedule.getStatus() != ScheduleStatus.PUBLISHED
                || !schedule.getDepartureAt().isAfter(OffsetDateTime.now(ZoneOffset.UTC))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Seats can only be locked for an upcoming published schedule."
            );
        }

        List<UUID> seatIds = request.seatIds().stream().sorted().toList();
        List<SeatInventoryRepository.LockedInventorySeat> lockedRows =
                seatInventory.lockRequestedSeats(schedule.getId(), seatIds);
        if (lockedRows.size() != seatIds.size()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "One or more selected seats do not belong to this schedule."
            );
        }

        for (SeatInventoryRepository.LockedInventorySeat row : lockedRows) {
            if (row.restricted()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Restricted seats cannot be booked."
                );
            }
            seatInventory.releaseExpiredLock(schedule.getId(), row.seatId());
            if (!"AVAILABLE".equals(row.status()) && !row.lockExpired()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "One or more selected seats are no longer available."
                );
            }
        }

        List<LockedSeatResponse> lockedSeats = new ArrayList<>(seatIds.size());
        OffsetDateTime expiresAt = seatInventory.calculateLockExpiry();
        for (UUID seatId : seatIds) {
            SeatInventoryRepository.LockedInventorySeat locked =
                    seatInventory.lockSeat(schedule.getId(), seatId, userId, expiresAt);
            if (locked == null) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "One or more selected seats are no longer available."
                );
            }
            UUID bookingId = seatInventory.createHoldBooking(
                    schedule.getId(),
                    seatId,
                    userId,
                    schedule.getPrice(),
                    locked.lockExpiresAt()
            );
            lockedSeats.add(new LockedSeatResponse(
                    bookingId,
                    seatId,
                    locked.lockExpiresAt()
            ));
        }

        return new LockSeatsResponse(
                schedule.getId(),
                lockedSeats.get(0).expiresAt(),
                lockedSeats
        );
    }

    @Transactional
    public int releaseExpiredLocks(int batchSize) {
        List<SeatInventoryRepository.ExpiredSeatLock> expired =
                seatInventory.lockExpiredSeats(batchSize);
        int released = 0;
        for (SeatInventoryRepository.ExpiredSeatLock lock : expired) {
            released += seatInventory.releaseExpiredLock(lock.scheduleId(), lock.seatId());
        }
        return released;
    }
}
