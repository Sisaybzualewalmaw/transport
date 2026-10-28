package com.woldia.transport.auth;

import com.woldia.transport.auth.dto.AuthResponse;
import com.woldia.transport.auth.dto.LoginRequest;
import com.woldia.transport.auth.dto.RegisterRequest;
import com.woldia.transport.user.AccountStatus;
import com.woldia.transport.user.UserAccount;
import com.woldia.transport.user.UserAccountRepository;
import com.woldia.transport.user.UserResponse;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private static final String DUMMY_BCRYPT_HASH =
            "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserAccountRepository users,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
        String phoneNumber = PhoneNumberNormalizer.normalize(request.phoneNumber());
        if (users.existsByPhoneNumber(phoneNumber)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account with that phone number already exists."
            );
        }

        validateBcryptPasswordLength(request.password());
        UserAccount user = new UserAccount(
                request.fullName().trim(),
                phoneNumber,
                passwordEncoder.encode(request.password())
        );
        return UserResponse.from(users.save(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String phoneNumber = PhoneNumberNormalizer.normalize(request.phoneNumber());
        Optional<UserAccount> result = users.findByPhoneNumber(phoneNumber);
        String passwordHash = result.map(UserAccount::getPasswordHash).orElse(DUMMY_BCRYPT_HASH);
        validateBcryptPasswordLength(request.password());
        boolean passwordMatches = passwordEncoder.matches(request.password(), passwordHash);

        UserAccount user = result
                .filter(account -> account.getStatus() == AccountStatus.ACTIVE)
                .filter(account -> passwordMatches)
                .orElseThrow(() -> new BadCredentialsException("Invalid phone number or password."));

        String token = jwtService.issue(user);
        return new AuthResponse(
                "Bearer",
                token,
                jwtService.getExpirationSeconds(),
                UserResponse.from(user)
        );
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
