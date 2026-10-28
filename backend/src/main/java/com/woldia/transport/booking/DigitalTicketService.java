package com.woldia.transport.booking;

import com.woldia.transport.booking.BookingPaymentRepository.DigitalTicket;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DigitalTicketService {
    private final BookingPaymentRepository bookings;

    public DigitalTicketService(BookingPaymentRepository bookings) {
        this.bookings = bookings;
    }

    @Transactional(readOnly = true)
    public DigitalTicketResponse getTicket(UUID bookingId, UUID userId) {
        DigitalTicket ticket = bookings.findPaidTicket(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Paid ticket not found."
                ));
        return new DigitalTicketResponse(
                ticket.bookingId(),
                ticket.scheduleId(),
                ticket.passengerName(),
                ticket.seatNumber(),
                ticket.seatLabel(),
                ticket.paymentState(),
                ticket.paidAt(),
                ticket.qrData()
        );
    }
}
