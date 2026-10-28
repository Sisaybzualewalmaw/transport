package com.woldia.transport.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.woldia.transport.auth.dto.LoginRequest;
import com.woldia.transport.auth.dto.RegisterRequest;
import com.woldia.transport.user.UserAccount;
import com.woldia.transport.user.UserAccountRepository;
import com.woldia.transport.user.UserRole;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock
    private UserAccountRepository users;

    @Mock
    private JwtService jwtService;

    private BCryptPasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder(10);
        authService = new AuthService(users, passwordEncoder, jwtService);
    }

    @Test
    void registrationStoresCanonicalPhoneAndBcryptHashWithPassengerRole() {
        when(users.existsByPhoneNumber("+251911223344")).thenReturn(false);
        when(users.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.register(new RegisterRequest(
                "  Hana Example  ",
                "0911223344",
                "secure-pass-123"
        ));

        ArgumentCaptor<UserAccount> accountCaptor = ArgumentCaptor.forClass(UserAccount.class);
        verify(users).save(accountCaptor.capture());
        UserAccount saved = accountCaptor.getValue();
        assertEquals("Hana Example", saved.getFullName());
        assertEquals("+251911223344", saved.getPhoneNumber());
        assertEquals(UserRole.PASSENGER, saved.getRole());
        assertTrue(passwordEncoder.matches("secure-pass-123", saved.getPasswordHash()));
    }

    @Test
    void registrationRejectsAnExistingCanonicalPhone() {
        when(users.existsByPhoneNumber("+251911223344")).thenReturn(true);

        assertThrows(ResponseStatusException.class, () -> authService.register(new RegisterRequest(
                "Hana Example",
                "+251911223344",
                "secure-pass-123"
        )));

        verify(users, never()).save(any(UserAccount.class));
    }

    @Test
    void loginReturnsSignedTokenAndTheAccountRole() {
        UserAccount account = new UserAccount(
                "Hana Example",
                "+251911223344",
                passwordEncoder.encode("secure-pass-123")
        );
        when(users.findByPhoneNumber("+251911223344")).thenReturn(Optional.of(account));
        when(jwtService.issue(account)).thenReturn("signed-token");
        when(jwtService.getExpirationSeconds()).thenReturn(900L);

        var response = authService.login(new LoginRequest("0911223344", "secure-pass-123"));

        assertEquals("Bearer", response.tokenType());
        assertEquals("signed-token", response.accessToken());
        assertEquals(900L, response.expiresInSeconds());
        assertNotNull(response.user());
        assertEquals(UserRole.PASSENGER, response.user().role());
        verify(jwtService).issue(account);
    }
}
