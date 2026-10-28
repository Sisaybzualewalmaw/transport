package com.woldia.transport.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

@ExtendWith(MockitoExtension.class)
class RevenueReportServiceTest {
    @Mock
    private NamedParameterJdbcTemplate jdbc;

    @InjectMocks
    private RevenueReportService reports;

    @Test
    void calculatesFiveAndNinetyFivePercentSharesFromPaidRevenue() {
        when(jdbc.queryForObject(anyString(), anyMap(), eq(BigDecimal.class)))
                .thenReturn(new BigDecimal("1000.00"));

        RevenueReportResponse result = reports.getRevenueReport(UUID.randomUUID(), true);

        assertEquals(new BigDecimal("1000.00"), result.totalRevenue());
        assertEquals(new BigDecimal("50.00"), result.terminalFeeShare());
        assertEquals(new BigDecimal("950.00"), result.operatorShare());
    }
}