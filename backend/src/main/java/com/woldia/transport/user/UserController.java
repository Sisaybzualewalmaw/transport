package com.woldia.transport.user;

import com.woldia.transport.auth.AccountPrincipal;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController {
    private final UserProfileService profiles;

    public UserController(UserProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/users/profile")
    public UserResponse getProfile(@AuthenticationPrincipal AccountPrincipal principal) {
        return profiles.getProfile(principal.getId());
    }

    @PatchMapping("/users/profile")
    public UserResponse updateProfile(
            @AuthenticationPrincipal AccountPrincipal principal,
            @Valid @RequestBody ProfileUpdateRequest request
    ) {
        return profiles.updateProfile(principal.getId(), request);
    }

    @PatchMapping("/admin/users/{userId}/role")
    public UserResponse updateRole(
            @PathVariable UUID userId,
            @Valid @RequestBody RoleUpdateRequest request
    ) {
        return profiles.updateRole(userId, request.role());
    }
}
