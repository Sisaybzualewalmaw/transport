package com.woldia.transport.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RevenueReportService {
    private static final BigDecimal TERMINAL_SHARE_RATE = new BigDecimal("0.05");

    private final NamedParameterJdbcTemplate jdbc;

    public RevenueReportService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public RevenueReportResponse getRevenueReport(UUID userId, boolean admin) {
        BigDecimal totalRevenue = jdbc.queryForObject(
                """
                select coalesce(sum(booking.total_fare), 0.00)
                from bookings booking
                join schedules schedule on schedule.id = booking.schedule_id
                join buses bus on bus.id = schedule.bus_id
                where booking.payment_state = 'PAID'::payment_status
                  and (
                      :admin = true
                      or exists (
                          select 1
                          from association_managers manager
                          where manager.user_id = :userId
                            and manager.association_id = bus.association_id
                      )
                  )
                """,
                Map.of("admin", admin, "userId", userId),
                BigDecimal.class
        );
        if (totalRevenue == null) {
            totalRevenue = BigDecimal.ZERO;
        }

        BigDecimal terminalFeeShare = totalRevenue
                .multiply(TERMINAL_SHARE_RATE)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal operatorShare = totalRevenue
                .subtract(terminalFeeShare)
                .setScale(2, RoundingMode.HALF_UP);

        return new RevenueReportResponse(totalRevenue, terminalFeeShare, operatorShare);
    }
}