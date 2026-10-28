package com.woldia.transport.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank
        @Pattern(regexp = "^(?:09\\d{8}|\\+2519\\d{8})$")
        String phoneNumber,

        @NotBlank
        @Size(max = 72)
        String password
) {
}
