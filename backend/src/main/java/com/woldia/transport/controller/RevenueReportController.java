package com.woldia.transport.controller;

import com.woldia.transport.auth.AccountPrincipal;
import com.woldia.transport.report.RevenueReportResponse;
import com.woldia.transport.report.RevenueReportService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
public class RevenueReportController {
    private final RevenueReportService reports;

    public RevenueReportController(RevenueReportService reports) {
        this.reports = reports;
    }

    @GetMapping("/revenue")
    public RevenueReportResponse getRevenueReport(
            @AuthenticationPrincipal AccountPrincipal principal
    ) {
        boolean admin = principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        return reports.getRevenueReport(principal.getId(), admin);
    }
}