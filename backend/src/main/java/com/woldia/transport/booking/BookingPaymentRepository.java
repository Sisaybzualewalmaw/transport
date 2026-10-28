package com.woldia.transport.booking;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class BookingPaymentRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public BookingPaymentRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<BookingKey> findBookingKey(UUID bookingId) {
        return jdbc.query(
                """
                select schedule_id, seat_id
                from bookings
                where id = :bookingId
                """,
                Map.of("bookingId", bookingId),
                (rs, rowNum) -> new BookingKey(
                        rs.getObject("schedule_id", UUID.class),
                        rs.getObject("seat_id", UUID.class)
                )
        ).stream().findFirst();
    }

    public Optional<MockPaymentBooking> findMockPaymentBooking(UUID bookingId, UUID userId) {
        return jdbc.query(
                """
                select id, total_fare
                from bookings
                where id = :bookingId
                  and user_id = :userId
                """,
                Map.of("bookingId", bookingId, "userId", userId),
                (rs, rowNum) -> new MockPaymentBooking(
                        rs.getObject("id", UUID.class),
                        rs.getBigDecimal("total_fare")
                )
        ).stream().findFirst();
    }

    public Optional<InventoryLock> lockInventory(UUID scheduleId, UUID seatId) {
        return jdbc.query(
                """
                select status::text as seat_status,
                       locked_by_user_id,
                       lock_expires_at,
                       coalesce(lock_expires_at > clock_timestamp(), false) as lock_active
                from schedule_seats
                where schedule_id = :scheduleId
                  and seat_id = :seatId
                for update
                """,
                Map.of("scheduleId", scheduleId, "seatId", seatId),
                (rs, rowNum) -> new InventoryLock(
                        rs.getString("seat_status"),
                        rs.getObject("locked_by_user_id", UUID.class),
                        rs.getObject("lock_expires_at", OffsetDateTime.class),
                        rs.getBoolean("lock_active")
                )
        ).stream().findFirst();
    }

    public Optional<PaymentBooking> lockBooking(UUID bookingId) {
        return jdbc.query(
                """
                select b.id as booking_id,
                       b.schedule_id,
                       b.seat_id,
                       b.user_id,
                       b.total_fare,
                       b.booking_state::text as booking_state,
                       b.payment_state::text as payment_state,
                       b.hold_expires_at,
                       b.payment_provider,
                       b.payment_reference,
                       b.ticket_qr_data,
                       b.paid_at,
                       u.full_name,
                       seat.seat_number,
                       seat.seat_label
                from bookings b
                join users u on u.id = b.user_id
                join seats seat on seat.id = b.seat_id
                where b.id = :bookingId
                for update of b
                """,
                Map.of("bookingId", bookingId),
                (rs, rowNum) -> new PaymentBooking(
                        rs.getObject("booking_id", UUID.class),
                        rs.getObject("schedule_id", UUID.class),
                        rs.getObject("seat_id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getBigDecimal("total_fare"),
                        rs.getString("booking_state"),
                        rs.getString("payment_state"),
                        rs.getObject("hold_expires_at", OffsetDateTime.class),
                        rs.getString("payment_provider"),
                        rs.getString("payment_reference"),
                        rs.getString("ticket_qr_data"),
                        rs.getObject("paid_at", OffsetDateTime.class),
                        rs.getString("full_name"),
                        rs.getInt("seat_number"),
                        rs.getString("seat_label")
                )
        ).stream().findFirst();
    }

    public boolean paymentReferenceExists(String provider, String reference) {
        Boolean exists = jdbc.queryForObject(
                """
                select exists (
                    select 1 from bookings
                    where payment_provider = :provider
                      and payment_reference = :reference
                )
                """,
                Map.of("provider", provider, "reference", reference),
                Boolean.class
        );
        return Boolean.TRUE.equals(exists);
    }

    public OffsetDateTime confirmPayment(
            UUID bookingId,
            String provider,
            String reference,
            String ticketQrData
    ) {
        return jdbc.query(
                """
                update bookings
                set booking_state = 'CONFIRMED'::booking_status,
                    payment_state = 'PAID'::payment_status,
                    payment_provider = :provider,
                    payment_reference = :reference,
                    paid_at = clock_timestamp(),
                    hold_expires_at = null,
                    ticket_qr_data = :ticketQrData
                where id = :bookingId
                  and booking_state = 'HOLD'::booking_status
                  and payment_state = 'PENDING'::payment_status
                returning paid_at
                """,
                Map.of(
                        "bookingId", bookingId,
                        "provider", provider,
                        "reference", reference,
                        "ticketQrData", ticketQrData
                ),
                (rs, rowNum) -> rs.getObject("paid_at", OffsetDateTime.class)
        ).stream().findFirst().orElse(null);
    }

    public int markSeatBooked(UUID scheduleId, UUID seatId, UUID userId) {
        return jdbc.update(
                """
                update schedule_seats
                set status = 'BOOKED'::seat_status,
                    locked_by_user_id = null,
                    lock_expires_at = null,
                    updated_at = clock_timestamp()
                where schedule_id = :scheduleId
                  and seat_id = :seatId
                  and status = 'LOCKED'::seat_status
                  and locked_by_user_id = :userId
                  and lock_expires_at > clock_timestamp()
                """,
                Map.of("scheduleId", scheduleId, "seatId", seatId, "userId", userId)
        );
    }

    public Optional<TicketRecord> lockPaidTicket(String qrData) {
        return jdbc.query(
                """
                select b.id as booking_id,
                       b.schedule_id,
                       b.payment_state::text as payment_state,
                       b.checked_in_at,
                       u.full_name,
                       seat.seat_number,
                       seat.seat_label
                from bookings b
                join users u on u.id = b.user_id
                join seats seat on seat.id = b.seat_id
                where b.ticket_qr_data = :qrData
                for update of b
                """,
                Map.of("qrData", qrData),
                (rs, rowNum) -> new TicketRecord(
                        rs.getObject("booking_id", UUID.class),
                        rs.getObject("schedule_id", UUID.class),
                        rs.getString("payment_state"),
                        rs.getObject("checked_in_at", OffsetDateTime.class),
                        rs.getString("full_name"),
                        rs.getInt("seat_number"),
                        rs.getString("seat_label")
                )
        ).stream().findFirst();
    }

    public Optional<DigitalTicket> findPaidTicket(UUID bookingId, UUID userId) {
        return jdbc.query(
                """
                select b.id as booking_id,
                       b.schedule_id,
                       b.payment_state::text as payment_state,
                       b.paid_at,
                       b.ticket_qr_data,
                       u.full_name,
                       seat.seat_number,
                       seat.seat_label
                from bookings b
                join users u on u.id = b.user_id
                join seats seat on seat.id = b.seat_id
                where b.id = :bookingId
                  and b.user_id = :userId
                  and b.payment_state = 'PAID'::payment_status
                """,
                Map.of("bookingId", bookingId, "userId", userId),
                (rs, rowNum) -> new DigitalTicket(
                        rs.getObject("booking_id", UUID.class),
                        rs.getObject("schedule_id", UUID.class),
                        rs.getString("payment_state"),
                        rs.getObject("paid_at", OffsetDateTime.class),
                        rs.getString("ticket_qr_data"),
                        rs.getString("full_name"),
                        rs.getInt("seat_number"),
                        rs.getString("seat_label")
                )
        ).stream().findFirst();
    }

    public OffsetDateTime checkIn(UUID bookingId) {
        return jdbc.query(
                """
                update bookings
                set checked_in_at = clock_timestamp()
                where id = :bookingId
                  and payment_state = 'PAID'::payment_status
                  and checked_in_at is null
                returning checked_in_at
                """,
                Map.of("bookingId", bookingId),
                (rs, rowNum) -> rs.getObject("checked_in_at", OffsetDateTime.class)
        ).stream().findFirst().orElse(null);
    }

    public record BookingKey(UUID scheduleId, UUID seatId) {
    }

    public record MockPaymentBooking(UUID bookingId, BigDecimal totalFare) {
    }

    public record InventoryLock(
            String status,
            UUID lockedByUserId,
            OffsetDateTime expiresAt,
            boolean active
    ) {
    }

    public record PaymentBooking(
            UUID bookingId,
            UUID scheduleId,
            UUID seatId,
            UUID userId,
            BigDecimal totalFare,
            String bookingState,
            String paymentState,
            OffsetDateTime holdExpiresAt,
            String paymentProvider,
            String paymentReference,
            String ticketQrData,
            OffsetDateTime paidAt,
            String passengerName,
            int seatNumber,
            String seatLabel
    ) {
    }

    public record TicketRecord(
            UUID bookingId,
            UUID scheduleId,
            String paymentState,
            OffsetDateTime checkedInAt,
            String passengerName,
            int seatNumber,
            String seatLabel
    ) {
    }

    public record DigitalTicket(
            UUID bookingId,
            UUID scheduleId,
            String paymentState,
            OffsetDateTime paidAt,
            String qrData,
            String passengerName,
            int seatNumber,
            String seatLabel
    ) {
    }
}
