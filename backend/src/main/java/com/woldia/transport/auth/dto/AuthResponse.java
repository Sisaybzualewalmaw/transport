package com.woldia.transport.auth.dto;

import com.woldia.transport.user.UserResponse;

public record AuthResponse(
        String tokenType,
        String accessToken,
        long expiresInSeconds,
        UserResponse user
) {
}
