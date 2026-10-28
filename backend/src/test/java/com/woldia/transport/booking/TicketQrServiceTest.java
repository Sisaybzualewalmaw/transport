package com.woldia.transport.booking;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TicketQrServiceTest {
    private final TicketQrService tickets = new TicketQrService(
            new ObjectMapper(),
            Base64.getEncoder().encodeToString(new byte[32])
    );

    @Test
    void createsSignedQrWithPassengerSeatAndTripClaims() throws Exception {
        UUID bookingId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        String qrData = tickets.create(bookingId, tripId, "Passenger Name", 12);
        String[] parts = qrData.split("\\.");
        byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
        TicketQrService.TicketClaims claims = new ObjectMapper().readValue(
                payload,
                TicketQrService.TicketClaims.class
        );

        assertTrue(tickets.isAuthentic(qrData));
        assertEquals(bookingId, claims.bookingId());
        assertEquals(tripId, claims.tripId());
        assertEquals("Passenger Name", claims.passengerName());
        assertEquals(12, claims.seatNumber());
    }

    @Test
    void rejectsChangedOrMalformedQrData() {
        String qrData = tickets.create(UUID.randomUUID(), UUID.randomUUID(), "Passenger", 1);

        assertFalse(tickets.isAuthentic(qrData + "tampered"));
        assertFalse(tickets.isAuthentic("invalid"));
        assertFalse(tickets.isAuthentic(null));
    }
}
