package com.woldia.transport.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.when;

import com.woldia.transport.auth.JwtAuthenticationFilter;
import com.woldia.transport.auth.JwtService;
import com.woldia.transport.auth.AccountPrincipal;
import com.woldia.transport.booking.BookingController;
import com.woldia.transport.booking.BookingService;
import com.woldia.transport.booking.DigitalTicketController;
import com.woldia.transport.booking.DigitalTicketResponse;
import com.woldia.transport.booking.DigitalTicketService;
import com.woldia.transport.booking.LockedSeatResponse;
import com.woldia.transport.booking.LockSeatsResponse;
import com.woldia.transport.booking.PaymentService;
import com.woldia.transport.booking.SeatMapItem;
import com.woldia.transport.booking.SeatMapResponse;
import com.woldia.transport.booking.SeatLockState;
import com.woldia.transport.booking.TicketVerificationController;
import com.woldia.transport.booking.TicketVerificationResponse;
import com.woldia.transport.booking.TicketVerificationService;
import com.woldia.transport.booking.PaymentWebhookController;
import com.woldia.transport.dispatch.DispatchManifestController;
import com.woldia.transport.dispatch.DispatchManifestResponse;
import com.woldia.transport.dispatch.DispatchService;
import com.woldia.transport.fleet.BusController;
import com.woldia.transport.fleet.BusService;
import com.woldia.transport.scheduling.ScheduleController;
import com.woldia.transport.scheduling.ScheduleService;
import com.woldia.transport.tariff.FareResponse;
import com.woldia.transport.tariff.TariffController;
import com.woldia.transport.tariff.TariffService;
import com.woldia.transport.user.UserAccountRepository;
import com.woldia.transport.user.UserController;
import com.woldia.transport.user.UserProfileService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@WebMvcTest({
        UserController.class,
        ScheduleController.class,
        BusController.class,
        TariffController.class,
        BookingController.class,
        PaymentWebhookController.class,
        TicketVerificationController.class,
        DispatchManifestController.class,
        DigitalTicketController.class
})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class RoleAuthorizationTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserAccountRepository users;

    @MockBean
    private UserProfileService profiles;

    @MockBean
    private ScheduleService schedules;

    @MockBean
    private BusService buses;

    @MockBean
    private TariffService tariffs;

    @MockBean
    private BookingService bookings;

    @MockBean
    private PaymentService payments;

    @MockBean
    private TicketVerificationService ticketVerification;

    @MockBean
    private DispatchService dispatch;

    @MockBean
    private DigitalTicketService digitalTickets;

    @Test
    void passengerCannotAccessRouteConfiguration() throws Exception {
        mockMvc.perform(get("/api/routes/config")
                        .with(user("passenger").roles("PASSENGER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanPassRouteConfigurationAuthorization() throws Exception {
        mockMvc.perform(get("/api/routes/config")
                        .with(user("admin").roles("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void passengerCannotValidateTickets() throws Exception {
        mockMvc.perform(post("/api/tickets/123/validate")
                        .with(user("passenger").roles("PASSENGER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void clerkCanPassTicketValidationAuthorization() throws Exception {
        mockMvc.perform(post("/api/tickets/123/validate")
                        .with(user("clerk").roles("TERMINAL_CLERK")))
                .andExpect(status().isNotFound());
    }

    @Test
    void passengerCannotAccessFleetManagement() throws Exception {
        mockMvc.perform(get("/api/fleet/buses")
                        .with(user("passenger").roles("PASSENGER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void associationManagerCanPassScheduleAuthorization() throws Exception {
        mockMvc.perform(get("/api/schedules/today")
                        .with(user("manager").roles("ASSOCIATION_MANAGER")))
                .andExpect(status().isNotFound());
    }

    @Test
    void profileRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/users/profile"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void scheduleSearchIsPublic() throws Exception {
        whenScheduleSearchReturnsEmpty();
        mockMvc.perform(get("/api/schedules/search")
                        .param("sourceCityId", UUID.randomUUID().toString())
                        .param("destinationCityId", UUID.randomUUID().toString())
                        .param("date", "2026-10-26"))
                .andExpect(status().isOk());
    }

    @Test
    void passengerCannotPublishSchedules() throws Exception {
        mockMvc.perform(post("/api/schedules")
                        .with(user("passenger").roles("PASSENGER"))
                        .contentType("application/json")
                        .content("""
                                {
                                  "busId":"00000000-0000-0000-0000-000000000001",
                                  "routeId":"00000000-0000-0000-0000-000000000002",
                                  "driverId":"00000000-0000-0000-0000-000000000003",
                                  "departureAt":"2027-01-01T08:00:00Z",
                                  "durationMinutes":120
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void associationManagerCannotChangeGlobalTariff() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                                "/api/admin/tariff")
                        .with(user("manager").roles("ASSOCIATION_MANAGER"))
                        .contentType("application/json")
                        .content("{\"baseRatePerKm\":2.50}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void fareCalculationIsPublic() throws Exception {
        when(tariffs.calculateFare(
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.eq(2)
        )).thenReturn(new FareResponse(
                UUID.randomUUID(),
                new BigDecimal("100.00"),
                new BigDecimal("2.00"),
                new BigDecimal("200.00"),
                (short) 2,
                new BigDecimal("1.15"),
                new BigDecimal("10.00"),
                new BigDecimal("240.00")
        ));

        mockMvc.perform(get("/api/routes/{routeId}/fare", UUID.randomUUID())
                        .param("busLevel", "2"))
                .andExpect(status().isOk());
    }

    @Test
    void passengerCanLockSeats() throws Exception {
        when(bookings.lockSeats(
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.any()
        )).thenReturn(new LockSeatsResponse(
                UUID.randomUUID(),
                OffsetDateTime.now().plusMinutes(10),
                List.of(new LockedSeatResponse(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        OffsetDateTime.now().plusMinutes(10)
                ))
        ));

        mockMvc.perform(post("/api/bookings/lock-seats")
                        .with(passengerAuthentication())
                        .contentType("application/json")
                        .content("""
                                {
                                  "scheduleId":"00000000-0000-0000-0000-000000000001",
                                  "seatIds":["00000000-0000-0000-0000-000000000002"]
                                }
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void passengerCanViewSeatMap() throws Exception {
        when(bookings.getSeatMap(org.mockito.ArgumentMatchers.any(UUID.class)))
                .thenReturn(new SeatMapResponse(
                        UUID.randomUUID(),
                        List.of(new SeatMapItem(
                                UUID.randomUUID(),
                                1,
                                "1",
                                SeatLockState.AVAILABLE
                        ))
                ));

        mockMvc.perform(get("/api/schedules/{scheduleId}/seats", UUID.randomUUID())
                        .with(user("passenger").roles("PASSENGER")))
                .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedUserCannotViewSeatMap() throws Exception {
        mockMvc.perform(get("/api/schedules/{scheduleId}/seats", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void associationManagerCannotLockPassengerSeats() throws Exception {
        mockMvc.perform(post("/api/bookings/lock-seats")
                        .with(user("manager").roles("ASSOCIATION_MANAGER"))
                        .contentType("application/json")
                        .content("""
                                {
                                  "scheduleId":"00000000-0000-0000-0000-000000000001",
                                  "seatIds":["00000000-0000-0000-0000-000000000002"]
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void paymentWebhookIsReachableWithoutUserAuthentication() throws Exception {
        when(payments.handleSuccessfulCallback(
                org.mockito.ArgumentMatchers.any()
        )).thenReturn(new com.woldia.transport.booking.PaymentConfirmationResponse(
                UUID.randomUUID(),
                "PAID",
                new BigDecimal("100.00"),
                OffsetDateTime.now()
        ));

        mockMvc.perform(post("/api/webhooks/payments")
                        .header("X-Payment-Webhook-Secret", "test-secret")
                        .contentType("application/json")
                        .content("""
                                {
                                  "bookingId":"00000000-0000-0000-0000-000000000001",
                                  "provider":"TELEBIRR",
                                  "paymentReference":"provider-ref-1",
                                  "amount":100.00,
                                  "successful":true
                                }
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void passengerCannotVerifyTicket() throws Exception {
        mockMvc.perform(post("/api/dispatch/verify-ticket")
                        .with(user("passenger").roles("PASSENGER"))
                        .contentType("application/json")
                        .content("{\"qrData\":\"invalid\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void terminalClerkCanVerifyTicket() throws Exception {
        when(ticketVerification.verify("valid-qr")).thenReturn(
                new TicketVerificationResponse(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "CHECKED_IN",
                        "Passenger",
                        1,
                        "1",
                        OffsetDateTime.now()
                )
        );

        mockMvc.perform(post("/api/dispatch/verify-ticket")
                        .with(user("clerk").roles("TERMINAL_CLERK"))
                        .contentType("application/json")
                        .content("{\"qrData\":\"valid-qr\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void passengerCannotReadPassengerManifest() throws Exception {
        mockMvc.perform(get("/api/dispatch/schedules/{scheduleId}/manifest", UUID.randomUUID())
                        .with(user("passenger").roles("PASSENGER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void associationManagerCanReadPassengerManifest() throws Exception {
        UUID scheduleId = UUID.randomUUID();
        UUID managerId = UUID.randomUUID();
        when(dispatch.getManifest(scheduleId, managerId, true)).thenReturn(new DispatchManifestResponse(
                UUID.randomUUID(),
                scheduleId,
                "CAPACITY_THRESHOLD",
                OffsetDateTime.now(),
                OffsetDateTime.now().plusHours(2),
                "Driver",
                List.of()
        ));

        mockMvc.perform(get("/api/dispatch/schedules/{scheduleId}/manifest", scheduleId)
                        .with(authentication("ASSOCIATION_MANAGER", managerId)))
                .andExpect(status().isOk());
    }

    @Test
    void passengerCanRetrieveOwnDigitalTicket() throws Exception {
        UUID bookingId = UUID.randomUUID();
        UUID passengerId = UUID.randomUUID();
        when(digitalTickets.getTicket(bookingId, passengerId)).thenReturn(
                new DigitalTicketResponse(
                        bookingId,
                        UUID.randomUUID(),
                        "Passenger",
                        1,
                        "1",
                        "PAID",
                        OffsetDateTime.now(),
                        "signed-qr"
                )
        );

        mockMvc.perform(get("/api/bookings/{bookingId}/ticket", bookingId)
                        .with(authentication("PASSENGER", passengerId)))
                .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedUserCannotRetrieveDigitalTicket() throws Exception {
        mockMvc.perform(get("/api/bookings/{bookingId}/ticket", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    private void whenScheduleSearchReturnsEmpty() {
        when(schedules.search(
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.any(UUID.class),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.isNull()
        )).thenReturn(List.of());
    }

    private RequestPostProcessor passengerAuthentication() {
        return authentication("PASSENGER", UUID.randomUUID());
    }

    private RequestPostProcessor authentication(String role, UUID userId) {
        AccountPrincipal principal = org.mockito.Mockito.mock(AccountPrincipal.class);
        when(principal.getId()).thenReturn(userId);
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                )
        );
    }
}
