package com.woldia.transport.user;

import jakarta.validation.constraints.NotNull;

public record RoleUpdateRequest(@NotNull UserRole role) {
}
