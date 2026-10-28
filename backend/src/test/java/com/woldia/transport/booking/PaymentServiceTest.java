package com.woldia.transport.booking;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.woldia.transport.booking.BookingPaymentRepository.BookingKey;
import com.woldia.transport.booking.BookingPaymentRepository.InventoryLock;
import com.woldia.transport.booking.BookingPaymentRepository.PaymentBooking;
import com.woldia.transport.dispatch.DispatchService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {
    @Mock
    private BookingPaymentRepository bookings;

    @Mock
    private DispatchService dispatch;

    private TicketQrService ticketQr;
    private PaymentService payments;

    @BeforeEach
    void setUp() {
        ticketQr = new TicketQrService(
                new ObjectMapper(),
                Base64.getEncoder().encodeToString(new byte[32])
        );
        payments = new PaymentService(bookings, ticketQr, dispatch, "provider-secret");
    }

    @Test
    void confirmsPaymentAndBooksSeatAtomically() {
        UUID bookingId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(5);
        OffsetDateTime paidAt = OffsetDateTime.now();
        configurePendingBooking(bookingId, scheduleId, seatId, userId, expiresAt);
        when(bookings.paymentReferenceExists("TELEBIRR", "tx-123")).thenReturn(false);
        when(bookings.confirmPayment(
                org.mockito.ArgumentMatchers.eq(bookingId),
                org.mockito.ArgumentMatchers.eq("TELEBIRR"),
                org.mockito.ArgumentMatchers.eq("tx-123"),
                org.mockito.ArgumentMatchers.anyString()
        )).thenReturn(paidAt);
        when(bookings.markSeatBooked(scheduleId, seatId, userId)).thenReturn(1);

        PaymentConfirmationResponse response = payments.handleSuccessfulCallback(
                new PaymentCallbackRequest(
                        bookingId,
                        PaymentProvider.TELEBIRR,
                        "tx-123",
                        new BigDecimal("100.00"),
                        true
                )
        );

        assertEquals("PAID", response.paymentStatus());
        assertEquals(paidAt, response.paidAt());
        org.mockito.ArgumentCaptor<String> qrData =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(bookings).confirmPayment(
                org.mockito.ArgumentMatchers.eq(bookingId),
                org.mockito.ArgumentMatchers.eq("TELEBIRR"),
                org.mockito.ArgumentMatchers.eq("tx-123"),
                qrData.capture()
        );
        assertTrueQrHasValidSignature(qrData.getValue());
        verify(dispatch).generateIfCapacityReached(scheduleId);
    }

    @Test
    void rejectsIncorrectAmountWithoutConfirmingPayment() {
        UUID bookingId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        configurePendingBooking(
                bookingId,
                scheduleId,
                seatId,
                userId,
                OffsetDateTime.now().plusMinutes(5)
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> payments.handleSuccessfulCallback(new PaymentCallbackRequest(
                        bookingId,
                        PaymentProvider.CBE_BIRR,
                        "tx-456",
                        new BigDecimal("99.00"),
                        true
                ))
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(bookings, never()).confirmPayment(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()
        );
    }

    @Test
    void repeatedMatchingPaymentReferenceReturnsPreviouslyIssuedTicket() {
        UUID bookingId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        String qrData = ticketQr.create(bookingId, scheduleId, "Passenger", 2);
        OffsetDateTime paidAt = OffsetDateTime.now();
        when(bookings.findBookingKey(bookingId)).thenReturn(
                Optional.of(new BookingKey(scheduleId, seatId))
        );
        when(bookings.lockInventory(scheduleId, seatId)).thenReturn(
                Optional.of(new InventoryLock("BOOKED", null, null, false))
        );
        when(bookings.lockBooking(bookingId)).thenReturn(Optional.of(new PaymentBooking(
                bookingId,
                scheduleId,
                seatId,
                userId,
                new BigDecimal("100.00"),
                "CONFIRMED",
                "PAID",
                null,
                "TELEBIRR",
                "tx-123",
                qrData,
                paidAt,
                "Passenger",
                2,
                "2"
        )));

        PaymentConfirmationResponse response = payments.handleSuccessfulCallback(
                new PaymentCallbackRequest(
                        bookingId,
                        PaymentProvider.TELEBIRR,
                        "tx-123",
                        new BigDecimal("100.00"),
                        true
                )
        );

        assertEquals(paidAt, response.paidAt());
        verify(bookings, never()).confirmPayment(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()
        );
    }

    @Test
    void webhookAuthorizationFailsClosedWhenSecretIsMissing() {
        PaymentService disabledWebhook = new PaymentService(
                bookings,
                ticketQr,
                dispatch,
                ""
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> disabledWebhook.authorizeWebhook("anything")
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
    }

    @Test
    void webhookAuthorizationRequiresTheConfiguredSecret() {
        payments.authorizeWebhook("provider-secret");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> payments.authorizeWebhook("wrong-secret")
        );

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
    }

    @Test
    void mockPaymentIsDisabledByDefault() {
        UUID bookingId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> payments.simulateSuccessfulPayment(
                        bookingId,
                        userId,
                        PaymentProvider.TELEBIRR
                )
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
        verify(bookings, never()).findMockPaymentBooking(bookingId, userId);
    }

    @Test
    void mockPaymentOnlyFindsTheAuthenticatedPassengersBooking() {
        UUID bookingId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        PaymentService enabledMockPayments = new PaymentService(
                bookings,
                ticketQr,
                dispatch,
                "provider-secret",
                true
        );

        when(bookings.findMockPaymentBooking(bookingId, userId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> enabledMockPayments.simulateSuccessfulPayment(
                        bookingId,
                        userId,
                        PaymentProvider.CBE_BIRR
                )
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verify(bookings, never()).confirmPayment(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()
        );
    }

    @Test
    void enabledMockPaymentConfirmsOnlyTheOwnersHeldBooking() {
        UUID bookingId = UUID.randomUUID();
        UUID scheduleId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        OffsetDateTime paidAt = OffsetDateTime.now();
        PaymentService enabledMockPayments = new PaymentService(
                bookings,
                ticketQr,
                dispatch,
                "provider-secret",
                true
        );
        when(bookings.findMockPaymentBooking(bookingId, userId)).thenReturn(
                Optional.of(new BookingPaymentRepository.MockPaymentBooking(
                        bookingId,
                        new BigDecimal("100.00")
                ))
        );
        configurePendingBooking(
                bookingId,
                scheduleId,
                seatId,
                userId,
                OffsetDateTime.now().plusMinutes(5)
        );
        when(bookings.paymentReferenceExists(
                "CBE_BIRR",
                "mock-cbe_birr-" + bookingId
        )).thenReturn(false);
        when(bookings.confirmPayment(
                org.mockito.ArgumentMatchers.eq(bookingId),
                org.mockito.ArgumentMatchers.eq("CBE_BIRR"),
                org.mockito.ArgumentMatchers.eq("mock-cbe_birr-" + bookingId),
                org.mockito.ArgumentMatchers.anyString()
        )).thenReturn(paidAt);
        when(bookings.markSeatBooked(scheduleId, seatId, userId)).thenReturn(1);

        PaymentConfirmationResponse response = enabledMockPayments.simulateSuccessfulPayment(
                bookingId,
                userId,
                PaymentProvider.CBE_BIRR
        );

        assertEquals("PAID", response.paymentStatus());
        assertEquals(paidAt, response.paidAt());
        verify(dispatch).generateIfCapacityReached(scheduleId);
    }

    private void configurePendingBooking(
            UUID bookingId,
            UUID scheduleId,
            UUID seatId,
            UUID userId,
            OffsetDateTime expiresAt
    ) {
        when(bookings.findBookingKey(bookingId)).thenReturn(
                Optional.of(new BookingKey(scheduleId, seatId))
        );
        when(bookings.lockInventory(scheduleId, seatId)).thenReturn(
                Optional.of(new InventoryLock("LOCKED", userId, expiresAt, true))
        );
        when(bookings.lockBooking(bookingId)).thenReturn(Optional.of(new PaymentBooking(
                bookingId,
                scheduleId,
                seatId,
                userId,
                new BigDecimal("100.00"),
                "HOLD",
                "PENDING",
                expiresAt,
                null,
                null,
                null,
                null,
                "Passenger",
                1,
                "1"
        )));
    }

    private void assertTrueQrHasValidSignature(String qrData) {
        org.junit.jupiter.api.Assertions.assertTrue(ticketQr.isAuthentic(qrData));
    }
}
