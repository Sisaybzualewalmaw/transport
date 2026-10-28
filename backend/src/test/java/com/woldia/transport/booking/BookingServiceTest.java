package com.woldia.transport.booking;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.woldia.transport.scheduling.Schedule;
import com.woldia.transport.scheduling.ScheduleRepository;
import com.woldia.transport.scheduling.ScheduleStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {
    @Mock
    private ScheduleRepository schedules;

    @Mock
    private SeatInventoryRepository seatInventory;

    @Mock
    private Schedule schedule;

    @Test
    void locksUpToFiveSeatsWithOneDatabaseExpiryAndCreatesHoldBookings() {
        UUID userId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        UUID firstSeat = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID secondSeat = UUID.fromString("00000000-0000-0000-0000-000000000002");
        UUID firstBooking = UUID.randomUUID();
        UUID secondBooking = UUID.randomUUID();
        OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(10);
        List<UUID> requestedSeats = List.of(secondSeat, firstSeat);

        when(schedules.findById(scheduleId)).thenReturn(Optional.of(schedule));
        when(schedule.getId()).thenReturn(scheduleId);
        when(schedule.getStatus()).thenReturn(ScheduleStatus.PUBLISHED);
        when(schedule.getDepartureAt()).thenReturn(OffsetDateTime.now(ZoneOffset.UTC).plusDays(1));
        when(schedule.getPrice()).thenReturn(new BigDecimal("100.00"));
        when(seatInventory.lockRequestedSeats(eq(scheduleId), any()))
                .thenReturn(List.of(
                        available(firstSeat),
                        available(secondSeat)
                ));
        when(seatInventory.calculateLockExpiry()).thenReturn(expiresAt);
        when(seatInventory.lockSeat(scheduleId, firstSeat, userId, expiresAt))
                .thenReturn(locked(firstSeat, expiresAt));
        when(seatInventory.lockSeat(scheduleId, secondSeat, userId, expiresAt))
                .thenReturn(locked(secondSeat, expiresAt));
        when(seatInventory.createHoldBooking(
                scheduleId, firstSeat, userId, new BigDecimal("100.00"), expiresAt
        )).thenReturn(firstBooking);
        when(seatInventory.createHoldBooking(
                scheduleId, secondSeat, userId, new BigDecimal("100.00"), expiresAt
        )).thenReturn(secondBooking);

        LockSeatsResponse response = new BookingService(schedules, seatInventory)
                .lockSeats(userId, new LockSeatsRequest(scheduleId, requestedSeats));

        assertEquals(scheduleId, response.scheduleId());
        assertEquals(expiresAt, response.expiresAt());
        assertEquals(2, response.seats().size());
        assertEquals(firstBooking, response.seats().get(0).bookingId());
        assertEquals(firstSeat, response.seats().get(0).seatId());
        assertEquals(secondBooking, response.seats().get(1).bookingId());
        verify(seatInventory).lockRequestedSeats(eq(scheduleId), eq(requestedSeats.stream().sorted().toList()));
        verify(seatInventory).calculateLockExpiry();
    }

    @Test
    void rejectsDuplicateSeatIdsBeforeLockingInventory() {
        UUID scheduleId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        BookingService service = new BookingService(schedules, seatInventory);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.lockSeats(
                        UUID.randomUUID(),
                        new LockSeatsRequest(scheduleId, List.of(seatId, seatId))
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        verify(seatInventory, never()).lockRequestedSeats(any(), any());
    }

    @Test
    void rejectsSixSeatsBeforeLockingInventory() {
        BookingService service = new BookingService(schedules, seatInventory);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.lockSeats(
                        UUID.randomUUID(),
                        new LockSeatsRequest(
                                UUID.randomUUID(),
                                List.of(
                                        UUID.randomUUID(),
                                        UUID.randomUUID(),
                                        UUID.randomUUID(),
                                        UUID.randomUUID(),
                                        UUID.randomUUID(),
                                        UUID.randomUUID()
                                )
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        verify(seatInventory, never()).lockRequestedSeats(any(), any());
    }

    @Test
    void rejectsOccupiedSeatWithoutPartiallyAcquiringRequestedSeats() {
        UUID userId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        UUID availableSeatId = UUID.randomUUID();
        UUID occupiedSeatId = UUID.randomUUID();
        when(schedules.findById(scheduleId)).thenReturn(Optional.of(schedule));
        when(schedule.getId()).thenReturn(scheduleId);
        when(schedule.getStatus()).thenReturn(ScheduleStatus.PUBLISHED);
        when(schedule.getDepartureAt()).thenReturn(OffsetDateTime.now(ZoneOffset.UTC).plusDays(1));
        when(seatInventory.lockRequestedSeats(eq(scheduleId), any()))
                .thenReturn(List.of(
                        available(availableSeatId),
                        new SeatInventoryRepository.LockedInventorySeat(
                                occupiedSeatId,
                                "BOOKED",
                                null,
                                false,
                                false
                        )
                ));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> new BookingService(schedules, seatInventory).lockSeats(
                        userId,
                        new LockSeatsRequest(scheduleId, List.of(availableSeatId, occupiedSeatId))
                )
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(seatInventory, never()).lockSeat(any(), any(), any(), any());
    }

    @Test
    void releasesExpiredLocksInBoundedBatch() {
        UUID scheduleId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        when(seatInventory.lockExpiredSeats(25)).thenReturn(
                List.of(new SeatInventoryRepository.ExpiredSeatLock(scheduleId, seatId))
        );
        when(seatInventory.releaseExpiredLock(scheduleId, seatId)).thenReturn(1);

        int released = new BookingService(schedules, seatInventory).releaseExpiredLocks(25);

        assertEquals(1, released);
        verify(seatInventory).lockExpiredSeats(25);
        verify(seatInventory).releaseExpiredLock(scheduleId, seatId);
    }

    private static SeatInventoryRepository.LockedInventorySeat available(UUID seatId) {
        return new SeatInventoryRepository.LockedInventorySeat(
                seatId,
                "AVAILABLE",
                null,
                false,
                false
        );
    }

    private static SeatInventoryRepository.LockedInventorySeat locked(
            UUID seatId,
            OffsetDateTime expiresAt
    ) {
        return new SeatInventoryRepository.LockedInventorySeat(
                seatId,
                "LOCKED",
                expiresAt,
                false,
                false
        );
    }
}
