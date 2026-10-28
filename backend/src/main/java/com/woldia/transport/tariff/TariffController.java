package com.woldia.transport.tariff;

import com.woldia.transport.auth.AccountPrincipal;
import com.woldia.transport.user.UserAccount;
import com.woldia.transport.user.UserAccountRepository;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class TariffController {
    private final TariffService tariffs;
    private final UserAccountRepository users;

    public TariffController(TariffService tariffs, UserAccountRepository users) {
        this.tariffs = tariffs;
        this.users = users;
    }

    @GetMapping("/admin/tariff")
    public SystemTariff getTariff() {
        return tariffs.getTariff();
    }

    @PutMapping("/admin/tariff")
    public SystemTariff updateTariff(
            @Valid @RequestBody TariffRequest request,
            @AuthenticationPrincipal AccountPrincipal principal
    ) {
        UserAccount admin = users.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated account no longer exists."
                ));
        return tariffs.updateTariff(request.baseRatePerKm(), admin);
    }

    @GetMapping("/routes/{routeId}/fare")
    public FareResponse calculateFare(
            @PathVariable UUID routeId,
            @RequestParam int busLevel
    ) {
        return tariffs.calculateFare(routeId, busLevel);
    }
}
