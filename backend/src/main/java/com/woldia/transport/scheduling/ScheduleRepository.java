package com.woldia.transport.scheduling;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScheduleRepository extends JpaRepository<Schedule, UUID> {
    boolean existsByBus_Id(UUID busId);

    @Query(value = """
            select exists (
                select 1
                from schedules s
                where s.status in ('DRAFT', 'PUBLISHED')
                  and (s.bus_id = :busId or s.driver_id = :driverId)
                  and (
                      s.duration_minutes is null
                      or (
                          s.departure_at < :endAt
                          and s.departure_at
                              + make_interval(mins => s.duration_minutes) > :startAt
                      )
                  )
            )
            """, nativeQuery = true)
    boolean hasOverlappingSchedule(
            @Param("busId") UUID busId,
            @Param("driverId") UUID driverId,
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt
    );

    @Query("""
            select s from Schedule s
            join fetch s.bus b
            join fetch s.route r
            join fetch r.originTerminal origin
            join fetch origin.city sourceCity
            join fetch r.destinationTerminal destination
            join fetch destination.city destinationCity
            join fetch s.driver d
            join fetch d.user driverUser
            where s.status = com.woldia.transport.scheduling.ScheduleStatus.PUBLISHED
              and s.departureAt >= :startAt
              and s.departureAt < :endAt
              and s.departureAt > CURRENT_TIMESTAMP
              and sourceCity.id = :sourceCityId
              and destinationCity.id = :destinationCityId
              and (:busLevel is null or b.level = :busLevel)
            order by s.departureAt
            """)
    List<Schedule> searchPublished(
            @Param("sourceCityId") UUID sourceCityId,
            @Param("destinationCityId") UUID destinationCityId,
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt,
            @Param("busLevel") Short busLevel
    );
}
