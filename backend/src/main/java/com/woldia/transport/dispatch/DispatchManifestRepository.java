package com.woldia.transport.dispatch;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DispatchManifestRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public DispatchManifestRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ManifestCandidate> findAutomaticCandidates(int limit) {
        return jdbc.query(
                """
                select s.id as schedule_id,
                       case
                           when s.departure_at <= clock_timestamp() then 'DEPARTURE'
                           else 'CAPACITY_THRESHOLD'
                       end as trigger_type
                from schedules s
                join buses b on b.id = s.bus_id
                where s.status = 'PUBLISHED'
                  and s.duration_minutes is not null
                  and not exists (
                      select 1 from dispatch_manifests dm
                      where dm.schedule_id = s.id
                  )
                  and (
                      s.departure_at <= clock_timestamp()
                      or (
                          s.departure_at > clock_timestamp()
                          and (
                              select count(*)
                              from bookings booking
                              where booking.schedule_id = s.id
                                and booking.payment_state = 'PAID'::payment_status
                          ) >= ceil(b.capacity * 0.80)
                      )
                  )
                order by s.departure_at
                limit :limit
                """,
                Map.of("limit", limit),
                (rs, rowNum) -> new ManifestCandidate(
                        rs.getObject("schedule_id", UUID.class),
                        rs.getString("trigger_type")
                )
        );
    }

    public Optional<String> findEligibleTriggerType(UUID scheduleId) {
        return jdbc.query(
                """
                select case
                           when s.departure_at <= clock_timestamp() then 'DEPARTURE'
                           else 'CAPACITY_THRESHOLD'
                       end as trigger_type
                from schedules s
                join buses b on b.id = s.bus_id
                where s.id = :scheduleId
                  and s.status = 'PUBLISHED'
                  and s.duration_minutes is not null
                  and (
                      s.departure_at <= clock_timestamp()
                      or (
                          s.departure_at > clock_timestamp()
                          and (
                              select count(*)
                              from bookings booking
                              where booking.schedule_id = s.id
                                and booking.payment_state = 'PAID'::payment_status
                          ) >= ceil(b.capacity * 0.80)
                      )
                  )
                """,
                Map.of("scheduleId", scheduleId),
                (rs, rowNum) -> rs.getString("trigger_type")
        ).stream().findFirst();
    }

    public boolean isManagerForSchedule(UUID userId, UUID scheduleId) {
        Boolean authorized = jdbc.queryForObject(
                """
                select exists (
                    select 1
                    from schedules s
                    join buses b on b.id = s.bus_id
                    join association_managers manager
                      on manager.association_id = b.association_id
                     and manager.user_id = :userId
                    where s.id = :scheduleId
                )
                """,
                Map.of("userId", userId, "scheduleId", scheduleId),
                Boolean.class
        );
        return Boolean.TRUE.equals(authorized);
    }

    public Optional<UUID> createManifestIfEligible(
            UUID scheduleId,
            String triggerType,
            UUID generatedBy
    ) {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("scheduleId", scheduleId)
                .addValue("triggerType", triggerType)
                .addValue("generatedBy", generatedBy);
        return jdbc.query(
                """
                insert into dispatch_manifests (
                    id, schedule_id, trigger_type, generated_at,
                    estimated_arrival_at, driver_name, generated_by
                )
                select gen_random_uuid(),
                       s.id,
                       :triggerType,
                       clock_timestamp(),
                       s.departure_at + make_interval(mins => s.duration_minutes),
                       driver_user.full_name,
                       :generatedBy
                from schedules s
                join buses bus on bus.id = s.bus_id
                join drivers driver on driver.id = s.driver_id
                join users driver_user on driver_user.id = driver.user_id
                where s.id = :scheduleId
                  and s.status = 'PUBLISHED'
                  and s.duration_minutes is not null
                  and (
                      (
                          :triggerType = 'DEPARTURE'
                          and s.departure_at <= clock_timestamp()
                      )
                      or (
                          :triggerType = 'CAPACITY_THRESHOLD'
                          and s.departure_at > clock_timestamp()
                          and (
                              select count(*)
                              from bookings booking
                              where booking.schedule_id = s.id
                                and booking.payment_state = 'PAID'::payment_status
                          ) >= ceil(bus.capacity * 0.80)
                      )
                  )
                on conflict (schedule_id) do nothing
                returning id
                """,
                parameters,
                (rs, rowNum) -> rs.getObject("id", UUID.class)
        ).stream().findFirst();
    }

    public int snapshotPaidPassengers(UUID manifestId, UUID scheduleId) {
        return jdbc.update(
                """
                insert into dispatch_manifest_passengers (
                    manifest_id, booking_id, passenger_name, seat_number, seat_label
                )
                select :manifestId, booking.id, passenger.full_name,
                       seat.seat_number, seat.seat_label
                from bookings booking
                join users passenger on passenger.id = booking.user_id
                join seats seat on seat.id = booking.seat_id
                where booking.schedule_id = :scheduleId
                  and booking.payment_state = 'PAID'::payment_status
                on conflict (manifest_id, booking_id) do nothing
                """,
                Map.of("manifestId", manifestId, "scheduleId", scheduleId)
        );
    }

    public Optional<DispatchManifestResponse> findManifest(UUID scheduleId) {
        Optional<ManifestSummary> summary = jdbc.query(
                """
                select id, schedule_id, trigger_type, generated_at,
                       estimated_arrival_at, driver_name
                from dispatch_manifests
                where schedule_id = :scheduleId
                """,
                Map.of("scheduleId", scheduleId),
                (rs, rowNum) -> new ManifestSummary(
                        rs.getObject("id", UUID.class),
                        rs.getObject("schedule_id", UUID.class),
                        rs.getString("trigger_type"),
                        rs.getObject("generated_at", OffsetDateTime.class),
                        rs.getObject("estimated_arrival_at", OffsetDateTime.class),
                        rs.getString("driver_name")
                )
        ).stream().findFirst();
        return summary.map(manifest -> new DispatchManifestResponse(
                manifest.manifestId(),
                manifest.scheduleId(),
                manifest.triggerType(),
                manifest.generatedAt(),
                manifest.estimatedArrivalAt(),
                manifest.driverName(),
                findPassengers(manifest.manifestId())
        ));
    }

    private List<DispatchManifestResponse.ManifestPassenger> findPassengers(UUID manifestId) {
        return jdbc.query(
                """
                select booking_id, passenger_name, seat_number, seat_label
                from dispatch_manifest_passengers
                where manifest_id = :manifestId
                order by seat_number
                """,
                Map.of("manifestId", manifestId),
                (rs, rowNum) -> new DispatchManifestResponse.ManifestPassenger(
                        rs.getObject("booking_id", UUID.class),
                        rs.getString("passenger_name"),
                        rs.getInt("seat_number"),
                        rs.getString("seat_label")
                )
        );
    }

    public record ManifestCandidate(UUID scheduleId, String triggerType) {
    }

    private record ManifestSummary(
            UUID manifestId,
            UUID scheduleId,
            String triggerType,
            OffsetDateTime generatedAt,
            OffsetDateTime estimatedArrivalAt,
            String driverName
    ) {
    }
}
