package com.woldia.transport.fleet;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "buses", uniqueConstraints = {
        @UniqueConstraint(name = "buses_association_id_side_number_key",
                columnNames = {"association_id", "side_number"})
})
public class Bus {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "association_id", nullable = false)
    private UUID associationId;

    @Column(name = "plate_number", nullable = false, unique = true, columnDefinition = "text")
    private String plateNumber;

    @Column(name = "side_number", nullable = false, columnDefinition = "text")
    private String sideNumber;

    @Column(name = "capacity", nullable = false)
    private int capacity;

    @Column(name = "level", nullable = false)
    private short level;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "bus_status")
    private BusStatus status = BusStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_driver_id")
    private Driver assignedDriver;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Bus() {
    }

    public Bus(
            UUID associationId,
            String plateNumber,
            String sideNumber,
            int capacity,
            short level
    ) {
        this.associationId = associationId;
        this.plateNumber = plateNumber;
        this.sideNumber = sideNumber;
        this.capacity = capacity;
        this.level = level;
    }

    public UUID getId() {
        return id;
    }

    public UUID getAssociationId() {
        return associationId;
    }

    public void setAssociationId(UUID associationId) {
        this.associationId = associationId;
    }

    public String getPlateNumber() {
        return plateNumber;
    }

    public void setPlateNumber(String plateNumber) {
        this.plateNumber = plateNumber;
    }

    public String getSideNumber() {
        return sideNumber;
    }

    public void setSideNumber(String sideNumber) {
        this.sideNumber = sideNumber;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public short getLevel() {
        return level;
    }

    public void setLevel(short level) {
        this.level = level;
    }

    public BusStatus getStatus() {
        return status;
    }

    public void setStatus(BusStatus status) {
        this.status = status;
    }

    public Driver getAssignedDriver() {
        return assignedDriver;
    }

    public void setAssignedDriver(Driver assignedDriver) {
        this.assignedDriver = assignedDriver;
    }
}
