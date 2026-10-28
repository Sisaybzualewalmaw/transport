package com.woldia.transport.dispatch;

import com.woldia.transport.dispatch.DispatchManifestRepository.ManifestCandidate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DispatchService {
    private final DispatchManifestRepository manifests;

    public DispatchService(DispatchManifestRepository manifests) {
        this.manifests = manifests;
    }

    @Transactional
    public DispatchManifestResponse triggerWorkflow(
            UUID scheduleId,
            UUID userId,
            boolean associationManager
    ) {
        requireManagerScope(scheduleId, userId, associationManager);
        String triggerType = manifests.findEligibleTriggerType(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Manifest generation starts when paid bookings reach 80% capacity or departure is due."
                ));
        return createAndRead(scheduleId, triggerType, userId, true);
    }

    @Transactional
    public DispatchManifestResponse getManifest(
            UUID scheduleId,
            UUID userId,
            boolean associationManager
    ) {
        requireManagerScope(scheduleId, userId, associationManager);
        return manifests.findManifest(scheduleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No passenger manifest has been generated for this schedule."
                ));
    }

    private void requireManagerScope(
            UUID scheduleId,
            UUID userId,
            boolean associationManager
    ) {
        if (associationManager && !manifests.isManagerForSchedule(userId, scheduleId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Association managers may only access their own schedules."
            );
        }
    }

    @Transactional
    public void generateIfCapacityReached(UUID scheduleId) {
        manifests.createManifestIfEligible(
                scheduleId,
                "CAPACITY_THRESHOLD",
                null
        );
        manifests.findManifest(scheduleId).ifPresent(manifest ->
                manifests.snapshotPaidPassengers(manifest.manifestId(), scheduleId));
    }

    @Transactional
    public int processAutomaticCandidates(int limit) {
        List<ManifestCandidate> candidates = manifests.findAutomaticCandidates(limit);
        int created = 0;
        for (ManifestCandidate candidate : candidates) {
            created += createAndRead(
                    candidate.scheduleId(),
                    candidate.triggerType(),
                    null,
                    false
            ) == null ? 0 : 1;
        }
        return created;
    }

    private DispatchManifestResponse createAndRead(
            UUID scheduleId,
            String triggerType,
            UUID userId,
            boolean required
    ) {
        manifests.createManifestIfEligible(scheduleId, triggerType, userId);
        var existing = manifests.findManifest(scheduleId);
        if (existing.isPresent()) {
            manifests.snapshotPaidPassengers(existing.get().manifestId(), scheduleId);
            return existing.get();
        }
        if (!required) {
            return null;
        }
        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "The schedule is not eligible for manifest generation."
        );
    }
}
