package com.woldia.transport.dispatch;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DispatchManifestWorker {
    private final DispatchService dispatch;
    private final int batchSize;

    public DispatchManifestWorker(
            DispatchService dispatch,
            @Value("${app.dispatch.manifest-batch-size:100}") int batchSize
    ) {
        this.dispatch = dispatch;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${app.dispatch.manifest-sweep-ms:30000}")
    public void generateDueManifests() {
        dispatch.processAutomaticCandidates(batchSize);
    }
}
