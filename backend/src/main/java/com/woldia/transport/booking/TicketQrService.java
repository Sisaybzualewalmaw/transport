package com.woldia.transport.booking;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TicketQrService {
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String VERSION = "tkt1";
    private final ObjectMapper objectMapper;
    private final SecretKeySpec signingKey;

    public TicketQrService(
            ObjectMapper objectMapper,
            @Value("${app.ticketing.qr-secret-base64}") String masterSecretBase64
    ) {
        this.objectMapper = objectMapper;
        byte[] masterSecret = Base64.getDecoder().decode(masterSecretBase64);
        this.signingKey = new SecretKeySpec(deriveKey(masterSecret), HMAC_ALGORITHM);
    }

    public String create(
            UUID bookingId,
            UUID tripId,
            String passengerName,
            int seatNumber
    ) {
        try {
            byte[] payload = objectMapper.writeValueAsBytes(new TicketClaims(
                    bookingId,
                    tripId,
                    passengerName,
                    seatNumber,
                    UUID.randomUUID()
            ));
            String encodedPayload = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(payload);
            return VERSION + "." + encodedPayload + "." + sign(encodedPayload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to create the ticket QR payload.", exception);
        }
    }

    public boolean isAuthentic(String qrData) {
        if (qrData == null || qrData.length() > 4096) {
            return false;
        }
        String[] parts = qrData.split("\\.", -1);
        if (parts.length != 3 || !VERSION.equals(parts[0])) {
            return false;
        }
        try {
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            TicketClaims claims = objectMapper.readValue(payload, TicketClaims.class);
            if (claims.bookingId() == null || claims.tripId() == null
                    || claims.passengerName() == null || claims.seatNumber() < 1
                    || claims.nonce() == null) {
                return false;
            }
            byte[] suppliedSignature = Base64.getUrlDecoder().decode(parts[2]);
            byte[] expectedSignature = Base64.getUrlDecoder().decode(sign(parts[1]));
            return MessageDigest.isEqual(expectedSignature, suppliedSignature);
        } catch (IllegalArgumentException | IOException exception) {
            return false;
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(signingKey);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    mac.doFinal(payload.getBytes(StandardCharsets.US_ASCII))
            );
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Ticket signing is unavailable.", exception);
        }
    }

    private static byte[] deriveKey(byte[] masterSecret) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(masterSecret, HMAC_ALGORITHM));
            return mac.doFinal("transport-ticket-qr-v1".getBytes(StandardCharsets.US_ASCII));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Ticket signing is unavailable.", exception);
        }
    }

    public record TicketClaims(
            UUID bookingId,
            UUID tripId,
            String passengerName,
            int seatNumber,
            UUID nonce
    ) {
    }
}
