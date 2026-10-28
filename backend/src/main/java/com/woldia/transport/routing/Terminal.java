package com.woldia.transport.routing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "terminals")
public class Terminal {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "city_id", nullable = false)
    private City city;

    @Column(name = "name", nullable = false, columnDefinition = "text")
    private String name;

    protected Terminal() {
    }

    public UUID getId() {
        return id;
    }

    public City getCity() {
        return city;
    }

    public String getName() {
        return name;
    }
}
