package com.woldia.transport.booking;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SeatInventoryRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public SeatInventoryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<LockedInventorySeat> lockRequestedSeats(UUID scheduleId, List<UUID> seatIds) {
        return jdbc.query(
                """
                select ss.seat_id,
                       ss.status::text as seat_status,
                       ss.lock_expires_at,
                       ss.lock_expires_at <= clock_timestamp() as lock_expired,
                       seat.is_restricted
                from schedule_seats ss
                join seats seat on seat.id = ss.seat_id
                where ss.schedule_id = :scheduleId
                  and ss.seat_id in (:seatIds)
                order by ss.seat_id
                for update of ss
                """,
                Map.of("scheduleId", scheduleId, "seatIds", seatIds),
                (rs, rowNum) -> new LockedInventorySeat(
                        rs.getObject("seat_id", UUID.class),
                        rs.getString("seat_status"),
                        rs.getObject("lock_expires_at", OffsetDateTime.class),
                        rs.getBoolean("lock_expired"),
                        rs.getBoolean("is_restricted")
                )
        );
    }

    public List<SeatMapItem> findSeatMap(UUID scheduleId) {
        return jdbc.query(
                """
                select seat.id as seat_id,
                       seat.seat_number,
                       seat.seat_label,
                       seat.is_restricted,
                       ss.status::text as seat_status,
                       coalesce(ss.lock_expires_at <= clock_timestamp(), false) as lock_expired
                from schedule_seats ss
                join seats seat on seat.id = ss.seat_id
                where ss.schedule_id = :scheduleId
                order by seat.seat_number
                """,
                Map.of("scheduleId", scheduleId),
                (rs, rowNum) -> mapSeat(rs)
        );
    }

    private static SeatMapItem mapSeat(ResultSet rs) throws SQLException {
        boolean restricted = rs.getBoolean("is_restricted");
        String status = rs.getString("seat_status");
        boolean expired = rs.getBoolean("lock_expired");
        SeatLockState state;
        if (restricted) {
            state = SeatLockState.RESTRICTED;
        } else if ("BOOKED".equals(status) || ("LOCKED".equals(status) && !expired)) {
            state = SeatLockState.OCCUPIED;
        } else {
            state = SeatLockState.AVAILABLE;
        }
        return new SeatMapItem(
                rs.getObject("seat_id", UUID.class),
                rs.getInt("seat_number"),
                rs.getString("seat_label"),
                state
        );
    }

    public int releaseExpiredLock(UUID scheduleId, UUID seatId) {
        jdbc.update(
                """
                delete from bookings
                where schedule_id = :scheduleId
                  and seat_id = :seatId
                  and booking_state = 'HOLD'
                  and hold_expires_at <= clock_timestamp()
                """,
                Map.of("scheduleId", scheduleId, "seatId", seatId)
        );
        return jdbc.update(
                """
                update schedule_seats
                set status = 'AVAILABLE'::seat_status,
                    locked_by_user_id = null,
                    lock_expires_at = null,
                    updated_at = now()
                where schedule_id = :scheduleId
                  and seat_id = :seatId
                  and status = 'LOCKED'::seat_status
                  and lock_expires_at <= clock_timestamp()
                """,
                Map.of("scheduleId", scheduleId, "seatId", seatId)
        );
    }

    public OffsetDateTime calculateLockExpiry() {
        return jdbc.getJdbcTemplate().queryForObject(
                "select clock_timestamp() + interval '10 minutes'",
                OffsetDateTime.class
        );
    }

    public LockedInventorySeat lockSeat(
            UUID scheduleId,
            UUID seatId,
            UUID userId,
            OffsetDateTime expiresAt
    ) {
        return jdbc.query(
                """
                update schedule_seats
                set status = 'LOCKED'::seat_status,
                    locked_by_user_id = :userId,
                    lock_expires_at = :expiresAt,
                    updated_at = clock_timestamp()
                where schedule_id = :scheduleId
                  and seat_id = :seatId
                  and status = 'AVAILABLE'::seat_status
                returning seat_id,
                          status::text as seat_status,
                          lock_expires_at,
                          false as lock_expired,
                          false as is_restricted
                """,
                Map.of(
                        "scheduleId", scheduleId,
                        "seatId", seatId,
                        "userId", userId,
                        "expiresAt", expiresAt
                ),
                (rs, rowNum) -> new LockedInventorySeat(
                        rs.getObject("seat_id", UUID.class),
                        rs.getString("seat_status"),
                        rs.getObject("lock_expires_at", OffsetDateTime.class),
                        rs.getBoolean("lock_expired"),
                        rs.getBoolean("is_restricted")
                )
        ).stream().findFirst().orElse(null);
    }

    public UUID createHoldBooking(
            UUID scheduleId,
            UUID seatId,
            UUID userId,
            java.math.BigDecimal totalFare,
            OffsetDateTime expiresAt
    ) {
        return jdbc.queryForObject(
                """
                insert into bookings (
                    id, schedule_id, seat_id, user_id, total_fare,
                    booking_state, payment_state, hold_expires_at
                )
                values (
                    gen_random_uuid(), :scheduleId, :seatId, :userId, :totalFare,
                    'HOLD'::booking_status, 'PENDING'::payment_status, :expiresAt
                )
                returning id
                """,
                Map.of(
                        "scheduleId", scheduleId,
                        "seatId", seatId,
                        "userId", userId,
                        "totalFare", totalFare,
                        "expiresAt", expiresAt
                ),
                UUID.class
        );
    }

    public List<ExpiredSeatLock> lockExpiredSeats(int limit) {
        return jdbc.query(
                """
                select schedule_id, seat_id
                from schedule_seats
                where status = 'LOCKED'::seat_status
                  and lock_expires_at <= clock_timestamp()
                order by lock_expires_at
                limit :limit
                for update skip locked
                """,
                Map.of("limit", limit),
                (rs, rowNum) -> new ExpiredSeatLock(
                        rs.getObject("schedule_id", UUID.class),
                        rs.getObject("seat_id", UUID.class)
                )
        );
    }

    public record LockedInventorySeat(
            UUID seatId,
            String status,
            OffsetDateTime lockExpiresAt,
            boolean lockExpired,
            boolean restricted
    ) {
    }

    public record ExpiredSeatLock(UUID scheduleId, UUID seatId) {
    }
}
