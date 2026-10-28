package com.woldia.transport.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "association_managers")
@IdClass(AssociationManager.Key.class)
public class AssociationManager {
    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "association_id", nullable = false)
    private UUID associationId;

    protected AssociationManager() {
    }

    public AssociationManager(UUID userId, UUID associationId) {
        this.userId = userId;
        this.associationId = associationId;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getAssociationId() {
        return associationId;
    }

    public static class Key implements Serializable {
        private UUID userId;

        public Key() {
        }

        public Key(UUID userId) {
            this.userId = userId;
        }

        public UUID getUserId() {
            return userId;
        }

        public void setUserId(UUID userId) {
            this.userId = userId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(userId, key.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId);
        }
    }
}
