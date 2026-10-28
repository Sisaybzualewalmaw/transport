package com.woldia.transport.booking;

import com.woldia.transport.booking.BookingPaymentRepository.TicketRecord;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TicketVerificationService {
    private final BookingPaymentRepository bookings;
    private final TicketQrService ticketQr;

    public TicketVerificationService(
            BookingPaymentRepository bookings,
            TicketQrService ticketQr
    ) {
        this.bookings = bookings;
        this.ticketQr = ticketQr;
    }

    @Transactional
    public TicketVerificationResponse verify(String qrData) {
        if (!ticketQr.isAuthentic(qrData)) {
            throw invalidTicket();
        }
        TicketRecord ticket = bookings.lockPaidTicket(qrData)
                .orElseThrow(TicketVerificationService::invalidTicket);
        if (!"PAID".equals(ticket.paymentState())) {
            throw invalidTicket();
        }
        if (ticket.checkedInAt() != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This ticket has already been checked in."
            );
        }
        OffsetDateTime checkedInAt = bookings.checkIn(ticket.bookingId());
        if (checkedInAt == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This ticket could not be checked in."
            );
        }
        return new TicketVerificationResponse(
                ticket.bookingId(),
                ticket.scheduleId(),
                "CHECKED_IN",
                ticket.passengerName(),
                ticket.seatNumber(),
                ticket.seatLabel(),
                checkedInAt
        );
    }

    private static ResponseStatusException invalidTicket() {
        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Ticket QR code is invalid or not associated with a paid booking."
        );
    }
}
