package com.woldia.transport.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PhoneNumberNormalizerTest {
    @Test
    void convertsLocalEthiopianPhoneToCanonicalInternationalForm() {
        assertEquals("+251911223344", PhoneNumberNormalizer.normalize("0911223344"));
    }

    @Test
    void acceptsCanonicalEthiopianPhone() {
        assertEquals("+251911223344", PhoneNumberNormalizer.normalize("+251911223344"));
    }

    @Test
    void rejectsMalformedPhoneNumber() {
        assertThrows(
                ResponseStatusException.class,
                () -> PhoneNumberNormalizer.normalize("09112233")
        );
    }
}
