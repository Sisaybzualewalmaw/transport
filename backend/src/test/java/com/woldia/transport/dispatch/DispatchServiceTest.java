package com.woldia.transport.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class DispatchServiceTest {
    @Mock
    private DispatchManifestRepository manifests;

    @Test
    void refusesManifestBeforeCapacityOrDepartureTrigger() {
        UUID scheduleId = UUID.randomUUID();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> new DispatchService(manifests).triggerWorkflow(
                        scheduleId,
                        UUID.randomUUID(),
                        false
                )
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(manifests, never()).createManifestIfEligible(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void createsOneSnapshotAfterCapacityThresholdIsReached() {
        UUID scheduleId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID manifestId = UUID.randomUUID();
        DispatchManifestResponse response = new DispatchManifestResponse(
                manifestId,
                scheduleId,
                "CAPACITY_THRESHOLD",
                OffsetDateTime.now(),
                OffsetDateTime.now().plusHours(2),
                "Driver",
                List.of()
        );
        when(manifests.findEligibleTriggerType(scheduleId))
                .thenReturn(Optional.of("CAPACITY_THRESHOLD"));
        when(manifests.createManifestIfEligible(
                scheduleId,
                "CAPACITY_THRESHOLD",
                userId
        )).thenReturn(Optional.of(manifestId));
        when(manifests.findManifest(scheduleId)).thenReturn(Optional.of(response));

        DispatchManifestResponse created = new DispatchService(manifests)
                .triggerWorkflow(scheduleId, userId, false);

        assertEquals(manifestId, created.manifestId());
        verify(manifests).snapshotPaidPassengers(manifestId, scheduleId);
    }

    @Test
    void restrictsAssociationManagerToSchedulesInTheirAssociation() {
        UUID scheduleId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(manifests.isManagerForSchedule(userId, scheduleId)).thenReturn(false);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> new DispatchService(manifests).getManifest(
                        scheduleId,
                        userId,
                        true
                )
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        verify(manifests, never()).findManifest(scheduleId);
    }
}
