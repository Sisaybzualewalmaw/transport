package com.woldia.transport.scheduling;

import com.woldia.transport.fleet.Bus;
import com.woldia.transport.fleet.Driver;
import com.woldia.transport.routing.Route;
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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "schedules")
public class Schedule {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bus_id", nullable = false)
    private Bus bus;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_id", nullable = false)
    private Route route;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "driver_id", nullable = false)
    private Driver driver;

    @Column(name = "departure_at", nullable = false)
    private OffsetDateTime departureAt;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "schedule_status")
    private ScheduleStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Schedule() {
    }

    public Schedule(
            Bus bus,
            Route route,
            Driver driver,
            OffsetDateTime departureAt,
            int durationMinutes,
            BigDecimal price
    ) {
        this.bus = bus;
        this.route = route;
        this.driver = driver;
        this.departureAt = departureAt;
        this.durationMinutes = durationMinutes;
        this.price = price;
        this.status = ScheduleStatus.PUBLISHED;
    }

    public UUID getId() {
        return id;
    }

    public Bus getBus() {
        return bus;
    }

    public Route getRoute() {
        return route;
    }

    public Driver getDriver() {
        return driver;
    }

    public OffsetDateTime getDepartureAt() {
        return departureAt;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public ScheduleStatus getStatus() {
        return status;
    }
}
