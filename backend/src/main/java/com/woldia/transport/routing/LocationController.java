package com.woldia.transport.routing;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
public class LocationController {
    private final JdbcTemplate jdbc;

    public LocationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/cities")
    public List<CityResponse> cities() {
        return jdbc.query(
                """
                select id, name
                from cities
                order by name
                """,
                (rs, rowNum) -> new CityResponse(
                        rs.getObject("id", java.util.UUID.class),
                        rs.getString("name")
                )
        );
    }
}
