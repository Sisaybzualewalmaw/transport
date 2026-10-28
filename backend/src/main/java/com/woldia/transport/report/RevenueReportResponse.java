package com.woldia.transport.report;

import java.math.BigDecimal;

public record RevenueReportResponse(
        BigDecimal totalRevenue,
        BigDecimal terminalFeeShare,
        BigDecimal operatorShare
) {
}