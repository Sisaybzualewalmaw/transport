package com.woldia.transport.user;

import java.util.UUID;

public record UserResponse(
        UUID id,
        String fullName,
        String phoneNumber,
        UserRole role
) {
    public static UserResponse from(UserAccount user) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getPhoneNumber(),
                user.getRole()
        );
    }
}
