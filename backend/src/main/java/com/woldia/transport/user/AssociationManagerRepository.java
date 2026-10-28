package com.woldia.transport.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssociationManagerRepository
        extends JpaRepository<AssociationManager, AssociationManager.Key> {
    Optional<AssociationManager> findByUserId(UUID userId);
}
