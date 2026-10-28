package com.woldia.transport.scheduling;

import com.woldia.transport.auth.AccountPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/schedules")
public class ScheduleController {
    private final ScheduleService schedules;

    public ScheduleController(ScheduleService schedules) {
        this.schedules = schedules;
    }

    @PostMapping
    public ScheduleResponse publish(
            @AuthenticationPrincipal AccountPrincipal principal,
            @Valid @RequestBody PublishScheduleRequest request
    ) {
        return schedules.publish(
                principal.getId(),
                List.copyOf(principal.getAuthorities()),
                request
        );
    }

    @GetMapping("/search")
    public List<ScheduleResponse> search(
            @RequestParam @NotNull UUID sourceCityId,
            @RequestParam @NotNull UUID destinationCityId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) @NotNull LocalDate date,
            @RequestParam(required = false) @Min(1) @Max(3) Integer busLevel
    ) {
        return schedules.search(sourceCityId, destinationCityId, date, busLevel);
    }
}
