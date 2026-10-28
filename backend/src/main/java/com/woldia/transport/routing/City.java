package com.woldia.transport.routing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "cities")
public class City {
    @Id
    private UUID id;

    @Column(name = "name", nullable = false, columnDefinition = "text")
    private String name;

    protected City() {
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
