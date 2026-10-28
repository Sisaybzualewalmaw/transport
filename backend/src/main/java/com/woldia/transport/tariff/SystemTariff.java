package com.woldia.transport.tariff;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "system_tariff")
public class SystemTariff {
    @Id
    private Short id = 1;

    @Column(name = "base_rate_per_km", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseRatePerKm;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SystemTariff() {
    }

    public SystemTariff(BigDecimal baseRatePerKm, UUID updatedBy) {
        this.baseRatePerKm = baseRatePerKm;
        this.updatedBy = updatedBy;
    }

    public BigDecimal getBaseRatePerKm() {
        return baseRatePerKm;
    }

    public UUID getUpdatedBy() {
        return updatedBy;
    }

    public void update(BigDecimal baseRatePerKm, UUID updatedBy) {
        this.baseRatePerKm = baseRatePerKm;
        this.updatedBy = updatedBy;
    }
}
