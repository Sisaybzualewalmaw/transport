package com.woldia.transport.routing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "routes")
public class Route {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "origin_terminal_id", nullable = false)
    private Terminal originTerminal;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_terminal_id", nullable = false)
    private Terminal destinationTerminal;

    @Column(name = "distance_km", nullable = false, precision = 8, scale = 2)
    private BigDecimal distanceKm;

    protected Route() {
    }

    public UUID getId() {
        return id;
    }

    public Terminal getOriginTerminal() {
        return originTerminal;
    }

    public Terminal getDestinationTerminal() {
        return destinationTerminal;
    }

    public BigDecimal getDistanceKm() {
        return distanceKm;
    }
}
