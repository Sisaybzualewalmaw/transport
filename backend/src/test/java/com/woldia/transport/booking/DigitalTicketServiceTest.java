package com.woldia.transport.booking;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.woldia.transport.booking.BookingPaymentRepository.DigitalTicket;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class DigitalTicketServiceTest {
    @Mock
    private BookingPaymentRepository bookings;

    @Test
    void returnsPaidTicketOnlyToItsOwner() {
        UUID bookingId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        OffsetDateTime paidAt = OffsetDateTime.now();
        when(bookings.findPaidTicket(bookingId, userId)).thenReturn(
                Optional.of(new DigitalTicket(
                        bookingId,
                        scheduleId,
                        "PAID",
                        paidAt,
                        "signed-qr",
                        "Passenger",
                        3,
                        "3"
                ))
        );

        DigitalTicketResponse response = new DigitalTicketService(bookings)
                .getTicket(bookingId, userId);

        assertEquals(bookingId, response.bookingId());
        assertEquals(scheduleId, response.scheduleId());
        assertEquals("signed-qr", response.qrData());
        assertEquals(paidAt, response.paidAt());
    }

    @Test
    void doesNotDiscloseMissingOrAnotherUsersTicket() {
        UUID bookingId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(bookings.findPaidTicket(bookingId, userId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> new DigitalTicketService(bookings).getTicket(bookingId, userId)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }
}
