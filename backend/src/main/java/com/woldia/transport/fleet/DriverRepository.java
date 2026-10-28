package com.woldia.transport.fleet;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DriverRepository extends JpaRepository<Driver, UUID> {
    @Query("select d from Driver d join fetch d.user where d.id = :id")
    Optional<Driver> findDetailedById(@Param("id") UUID id);

    @Query(value = "select id from drivers where id = :driverId for update", nativeQuery = true)
    UUID lockForScheduling(@Param("driverId") UUID driverId);
}
