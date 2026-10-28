package com.woldia.transport.dispatch;

import com.woldia.transport.auth.AccountPrincipal;
import org.springframework.security.core.GrantedAuthority;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/dispatch/schedules")
public class DispatchManifestController {
    private final DispatchService dispatch;

    public DispatchManifestController(DispatchService dispatch) {
        this.dispatch = dispatch;
    }

    @PostMapping("/{scheduleId}/manifest")
    public DispatchManifestResponse generateManifest(
            @PathVariable UUID scheduleId,
            @AuthenticationPrincipal AccountPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required."
            );
        }
        return dispatch.triggerWorkflow(
                scheduleId,
                principal.getId(),
                isAssociationManager(principal)
        );
    }

    @GetMapping("/{scheduleId}/manifest")
    public DispatchManifestResponse getManifest(
            @PathVariable UUID scheduleId,
            @AuthenticationPrincipal AccountPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required."
            );
        }
        return dispatch.getManifest(
                scheduleId,
                principal.getId(),
                isAssociationManager(principal)
        );
    }

    private static boolean isAssociationManager(AccountPrincipal principal) {
        return principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ASSOCIATION_MANAGER"::equals);
    }
}
