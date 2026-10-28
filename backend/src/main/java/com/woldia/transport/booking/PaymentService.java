package com.woldia.transport.booking;

import com.woldia.transport.booking.BookingPaymentRepository.BookingKey;
import com.woldia.transport.booking.BookingPaymentRepository.InventoryLock;
import com.woldia.transport.booking.BookingPaymentRepository.MockPaymentBooking;
import com.woldia.transport.booking.BookingPaymentRepository.PaymentBooking;
import com.woldia.transport.dispatch.DispatchService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentService {
    private final BookingPaymentRepository bookings;
    private final TicketQrService ticketQr;
    private final DispatchService dispatch;
    private final byte[] webhookSecret;
    private final boolean mockPaymentEnabled;

    @Autowired
    public PaymentService(
            BookingPaymentRepository bookings,
            TicketQrService ticketQr,
            DispatchService dispatch,
            @Value("${app.payment.webhook-secret:}") String webhookSecret,
            @Value("${app.payment.mock-enabled:false}") boolean mockPaymentEnabled
    ) {
        this.bookings = bookings;
        this.ticketQr = ticketQr;
        this.dispatch = dispatch;
        this.webhookSecret = webhookSecret.getBytes(StandardCharsets.UTF_8);
        this.mockPaymentEnabled = mockPaymentEnabled;
    }

    public PaymentService(
            BookingPaymentRepository bookings,
            TicketQrService ticketQr,
            DispatchService dispatch,
            String webhookSecret
    ) {
        this(bookings, ticketQr, dispatch, webhookSecret, false);
    }

    public void authorizeWebhook(String suppliedSecret) {
        if (webhookSecret.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Payment webhook is disabled until PAYMENT_WEBHOOK_SECRET is configured."
            );
        }
        if (suppliedSecret == null || !MessageDigest.isEqual(
                webhookSecret,
                suppliedSecret.getBytes(StandardCharsets.UTF_8)
        )) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid payment webhook credentials."
            );
        }
    }

    @Transactional
    public PaymentConfirmationResponse simulateSuccessfulPayment(
            UUID bookingId,
            UUID userId,
            PaymentProvider provider
    ) {
        if (!mockPaymentEnabled) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Mock payment is disabled. Enable MOCK_PAYMENT_ENABLED for a demo environment."
            );
        }
        MockPaymentBooking booking = bookings.findMockPaymentBooking(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found."
                ));
        return handleSuccessfulCallback(new PaymentCallbackRequest(
                booking.bookingId(),
                provider,
                "mock-" + provider.name().toLowerCase(java.util.Locale.ROOT)
                        + "-" + booking.bookingId(),
                booking.totalFare(),
                true
        ));
    }

    @Transactional
    public PaymentConfirmationResponse handleSuccessfulCallback(PaymentCallbackRequest request) {
        if (!request.successful()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This endpoint only accepts successful payment callbacks."
            );
        }

        BookingKey key = bookings.findBookingKey(request.bookingId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found."
                ));
        InventoryLock inventory = bookings.lockInventory(key.scheduleId(), key.seatId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "The booking seat inventory no longer exists."
                ));
        PaymentBooking booking = bookings.lockBooking(request.bookingId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking no longer exists."
                ));

        if ("PAID".equals(booking.paymentState())) {
            if (request.provider().name().equals(booking.paymentProvider())
                    && request.paymentReference().equals(booking.paymentReference())
                    && request.amount().compareTo(booking.totalFare()) == 0) {
                return new PaymentConfirmationResponse(
                        booking.bookingId(),
                        "PAID",
                        booking.totalFare(),
                        booking.paidAt()
                );
            }
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The booking has already been paid using a different payment reference."
            );
        }

        if (request.amount().compareTo(booking.totalFare()) != 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Payment amount does not match the booking fare."
            );
        }
        if (!"HOLD".equals(booking.bookingState())
                || !"PENDING".equals(booking.paymentState())
                || !"LOCKED".equals(inventory.status())
                || !booking.userId().equals(inventory.lockedByUserId())
                || !inventory.active()
                || booking.holdExpiresAt() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The seat hold has expired or is no longer payable."
            );
        }
        if (bookings.paymentReferenceExists(
                request.provider().name(),
                request.paymentReference()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This payment reference has already been used."
            );
        }

        String qrData = ticketQr.create(
                booking.bookingId(),
                booking.scheduleId(),
                booking.passengerName(),
                booking.seatNumber()
        );
        OffsetDateTime paidAt;
        try {
            paidAt = bookings.confirmPayment(
                    booking.bookingId(),
                    request.provider().name(),
                    request.paymentReference(),
                    qrData
            );
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The payment reference or ticket is already in use.",
                    exception
            );
        }
        if (paidAt == null || bookings.markSeatBooked(
                booking.scheduleId(),
                booking.seatId(),
                booking.userId()
        ) != 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The seat hold expired while payment was being confirmed."
            );
        }

        dispatch.generateIfCapacityReached(booking.scheduleId());
        return new PaymentConfirmationResponse(
                booking.bookingId(),
                "PAID",
                booking.totalFare(),
                paidAt
        );
    }
}
