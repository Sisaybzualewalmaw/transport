package com.woldia.transport.fleet;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusRepository extends JpaRepository<Bus, UUID> {
    @Query("select b from Bus b left join fetch b.assignedDriver d "
            + "left join fetch d.user where b.associationId = :associationId order by b.plateNumber")
    List<Bus> findAllByAssociationId(@Param("associationId") UUID associationId);

    @Query("select b from Bus b left join fetch b.assignedDriver d "
            + "left join fetch d.user where b.id = :id")
    Optional<Bus> findDetailedById(@Param("id") UUID id);

    @Query(value = "select id from buses where id = :busId for update", nativeQuery = true)
    UUID lockForScheduling(@Param("busId") UUID busId);
}
