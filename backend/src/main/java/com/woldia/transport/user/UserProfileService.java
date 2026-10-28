package com.woldia.transport.user;

import com.woldia.transport.auth.PhoneNumberNormalizer;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserProfileService {
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserProfileService(UserAccountRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public UserResponse getProfile(UUID userId) {
        return UserResponse.from(findUser(userId));
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, ProfileUpdateRequest request) {
        UserAccount user = findUser(userId);
        boolean changed = false;

        if (request.fullName() != null) {
            String fullName = request.fullName().trim();
            if (fullName.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name cannot be blank.");
            }
            user.setFullName(fullName);
            changed = true;
        }

        if (request.phoneNumber() != null) {
            String phoneNumber = PhoneNumberNormalizer.normalize(request.phoneNumber());
            if (!phoneNumber.equals(user.getPhoneNumber())) {
                if (users.existsByPhoneNumber(phoneNumber)) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "An account with that phone number already exists."
                    );
                }
                user.setPhoneNumber(phoneNumber);
                changed = true;
            }
        }

        if (request.password() != null) {
            validateBcryptPasswordLength(request.password());
            user.setPasswordHash(passwordEncoder.encode(request.password()));
            user.invalidateTokens();
            changed = true;
        }

        if (!changed) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "At least one profile field must be supplied."
            );
        }

        return UserResponse.from(users.save(user));
    }

    @Transactional
    public UserResponse updateRole(UUID userId, UserRole role) {
        UserAccount user = findUser(userId);
        if (user.getRole() != role) {
            user.setRole(role);
            users.save(user);
        }
        return UserResponse.from(user);
    }

    private UserAccount findUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "User account was not found."
                ));
    }

    private static void validateBcryptPasswordLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must not exceed 72 UTF-8 bytes."
            );
        }
    }
}
