package com.woldia.transport.routing;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RouteRepository extends JpaRepository<Route, UUID> {
    @Query("select r from Route r "
            + "join fetch r.originTerminal origin "
            + "join fetch origin.city "
            + "join fetch r.destinationTerminal destination "
            + "join fetch destination.city "
            + "where r.id = :id")
    Optional<Route> findDetailedById(@Param("id") UUID id);
}
