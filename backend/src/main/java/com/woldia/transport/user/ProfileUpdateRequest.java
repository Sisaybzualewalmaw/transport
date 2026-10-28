package com.woldia.transport.user;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @Size(min = 1, max = 120)
        String fullName,

        @Pattern(regexp = "^(?:09\\d{8}|\\+2519\\d{8})$")
        String phoneNumber,

        @Size(min = 8, max = 72)
        String password
) {
}
