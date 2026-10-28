package com.woldia.transport.auth;

import com.woldia.transport.user.UserAccount;
import com.woldia.transport.user.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final SecretKey signingKey;
    private final String issuer;
    private final long expirationSeconds;

    public JwtService(
            @Value("${app.jwt.secret-base64}") String secretBase64,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.expiration-seconds}") long expirationSeconds
    ) {
        byte[] keyBytes = Decoders.BASE64.decode(secretBase64);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT signing key must contain at least 256 bits.");
        }
        if (expirationSeconds <= 0) {
            throw new IllegalArgumentException("JWT expiration must be positive.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.issuer = issuer;
        this.expirationSeconds = expirationSeconds;
    }

    public String issue(UserAccount user) {
        Instant issuedAt = Instant.now();
        return Jwts.builder()
                .issuer(issuer)
                .subject(user.getId().toString())
                .claim("role", user.getRole().name())
                .claim("tokenVersion", user.getTokenVersion())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(issuedAt.plusSeconds(expirationSeconds)))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public TokenClaims parseAndValidate(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        String roleValue = claims.get("role", String.class);
        Integer tokenVersion = claims.get("tokenVersion", Integer.class);
        if (claims.getSubject() == null || roleValue == null || tokenVersion == null) {
            throw new JwtException("Token is missing a required claim.");
        }

        return new TokenClaims(
                UUID.fromString(claims.getSubject()),
                UserRole.valueOf(roleValue),
                tokenVersion
        );
    }

    public boolean matchesUser(TokenClaims claims, UserAccount user) {
        return claims.userId().equals(user.getId())
                && claims.role() == user.getRole()
                && claims.tokenVersion() == user.getTokenVersion();
    }

    public long getExpirationSeconds() {
        return expirationSeconds;
    }

    public record TokenClaims(UUID userId, UserRole role, int tokenVersion) {
    }
}
