package com.woldia.transport.booking;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.woldia.transport.booking.BookingPaymentRepository.TicketRecord;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class TicketVerificationServiceTest {
    @Mock
    private BookingPaymentRepository bookings;

    @Test
    void checksInAuthenticPaidTicketOnce() {
        TicketQrService ticketQr = ticketQrService();
        UUID bookingId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        String qrData = ticketQr.create(bookingId, scheduleId, "Passenger", 8);
        OffsetDateTime checkedInAt = OffsetDateTime.now();
        when(bookings.lockPaidTicket(qrData)).thenReturn(Optional.of(new TicketRecord(
                bookingId,
                scheduleId,
                "PAID",
                null,
                "Passenger",
                8,
                "8"
        )));
        when(bookings.checkIn(bookingId)).thenReturn(checkedInAt);

        TicketVerificationResponse response = new TicketVerificationService(bookings, ticketQr)
                .verify(qrData);

        assertEquals("CHECKED_IN", response.status());
        assertEquals(bookingId, response.bookingId());
        assertEquals(8, response.seatNumber());
        assertEquals(checkedInAt, response.checkedInAt());
    }

    @Test
    void rejectsTamperedQrBeforeDatabaseLookup() {
        TicketQrService ticketQr = ticketQrService();
        String qrData = ticketQr.create(UUID.randomUUID(), UUID.randomUUID(), "Passenger", 1);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> new TicketVerificationService(bookings, ticketQr).verify(qrData + "x")
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verify(bookings, never()).lockPaidTicket(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void rejectsAlreadyCheckedInTicket() {
        TicketQrService ticketQr = ticketQrService();
        UUID bookingId = UUID.randomUUID();
        String qrData = ticketQr.create(bookingId, UUID.randomUUID(), "Passenger", 1);
        when(bookings.lockPaidTicket(qrData)).thenReturn(Optional.of(new TicketRecord(
                bookingId,
                UUID.randomUUID(),
                "PAID",
                OffsetDateTime.now(),
                "Passenger",
                1,
                "1"
        )));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> new TicketVerificationService(bookings, ticketQr).verify(qrData)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(bookings, never()).checkIn(bookingId);
    }

    private static TicketQrService ticketQrService() {
        return new TicketQrService(
                new ObjectMapper(),
                Base64.getEncoder().encodeToString(new byte[32])
        );
    }
}
