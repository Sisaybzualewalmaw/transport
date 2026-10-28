package com.woldia.transport.fleet;

import com.woldia.transport.auth.AccountPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fleet/buses")
public class BusController {
    private final BusService buses;

    public BusController(BusService buses) {
        this.buses = buses;
    }

    @GetMapping
    public List<BusResponse> list(
            @AuthenticationPrincipal AccountPrincipal principal
    ) {
        return buses.listBuses(principal.getId(), List.copyOf(principal.getAuthorities()));
    }

    @GetMapping("/{busId}")
    public BusResponse get(
            @AuthenticationPrincipal AccountPrincipal principal,
            @PathVariable UUID busId
    ) {
        return buses.getBus(principal.getId(), List.copyOf(principal.getAuthorities()), busId);
    }

    @PostMapping
    public BusResponse create(
            @AuthenticationPrincipal AccountPrincipal principal,
            @Valid @RequestBody BusRequest request
    ) {
        return buses.createBus(principal.getId(), List.copyOf(principal.getAuthorities()), request);
    }

    @PutMapping("/{busId}")
    public BusResponse update(
            @AuthenticationPrincipal AccountPrincipal principal,
            @PathVariable UUID busId,
            @Valid @RequestBody BusRequest request
    ) {
        return buses.updateBus(
                principal.getId(),
                List.copyOf(principal.getAuthorities()),
                busId,
                request
        );
    }

    @DeleteMapping("/{busId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal AccountPrincipal principal,
            @PathVariable UUID busId
    ) {
        buses.deleteBus(principal.getId(), List.copyOf(principal.getAuthorities()), busId);
    }
}
