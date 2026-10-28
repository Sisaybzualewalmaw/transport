package com.woldia.transport.auth;

import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class PhoneNumberNormalizer {
    private static final Pattern ETHIOPIAN_PHONE =
            Pattern.compile("^(?:09\\d{8}|\\+2519\\d{8})$");

    private PhoneNumberNormalizer() {
    }

    public static String normalize(String phoneNumber) {
        String value = phoneNumber == null ? "" : phoneNumber.trim();
        if (!ETHIOPIAN_PHONE.matcher(value).matches()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Phone number must use 09xxxxxxxx or +2519xxxxxxxx format."
            );
        }
        return value.startsWith("09") ? "+251" + value.substring(1) : value;
    }
}
