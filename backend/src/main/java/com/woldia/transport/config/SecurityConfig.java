package com.woldia.transport.config;

import com.woldia.transport.auth.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter
    ) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, cause) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write(
                                    "{\"status\":401,\"error\":\"Unauthorized\"}");
                        })
                        .accessDeniedHandler((request, response, cause) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write(
                                    "{\"status\":403,\"error\":\"Forbidden\"}");
                        }))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login")
                        .permitAll()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/schedules/search",
                                "/api/locations/cities",
                                "/api/routes/*/fare"
                        )
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/schedules/*/seats")
                        .authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/webhooks/payments")
                        .permitAll()
                        .requestMatchers("/api/v1/reports/**")
                        .hasAnyRole("ASSOCIATION_MANAGER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/dispatch/verify-ticket")
                        .hasRole("TERMINAL_CLERK")
                        .requestMatchers("/api/dispatch/schedules/**")
                        .hasAnyRole("TERMINAL_CLERK", "ASSOCIATION_MANAGER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/bookings/lock-seats")
                        .hasAnyRole("PASSENGER", "TERMINAL_CLERK")
                        .requestMatchers(HttpMethod.POST, "/api/bookings/*/mock-payment")
                        .hasRole("PASSENGER")
                        .requestMatchers(HttpMethod.GET, "/api/bookings/*/ticket")
                        .authenticated()
                        .requestMatchers("/api/routes/**", "/api/route-config/**")
                        .hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/tickets/*/validate")
                        .hasRole("TERMINAL_CLERK")
                        .requestMatchers(
                                "/api/associations/**",
                                "/api/fleet/**",
                                "/api/drivers/**",
                                "/api/schedules/**"
                        )
                        .hasAnyRole("ASSOCIATION_MANAGER", "ADMIN")
                        .requestMatchers("/api/admin/**")
                        .hasRole("ADMIN")
                        .requestMatchers("/api/users/profile")
                        .authenticated()
                        .anyRequest()
                        .authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(java.util.List.of(
                "http://localhost:*",
                "http://127.0.0.1:*"
        ));
        configuration.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type", "Accept"));
        configuration.setExposedHeaders(java.util.List.of("Authorization"));
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(
            JwtAuthenticationFilter filter
    ) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration =
                new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }
}
