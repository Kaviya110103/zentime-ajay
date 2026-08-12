package com.example.demo.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SchemaMaintenanceService {
    private final JdbcTemplate jdbcTemplate;
    private final DataSource dataSource;
    private final boolean flywayEnabled;
    private final Map<String, Boolean> migratedSchemas = new ConcurrentHashMap<>();

    public SchemaMaintenanceService(
            JdbcTemplate jdbcTemplate,
            DataSource dataSource,
            @Value("${app.flyway.enabled:true}") boolean flywayEnabled) {
        this.jdbcTemplate = jdbcTemplate;
        this.dataSource = dataSource;
        this.flywayEnabled = flywayEnabled;
    }

    public void ensureEmployeeSchema() {
        if (!flywayEnabled) {
            return;
        }

        String dbName = resolveDatabaseName();
        if (dbName == null || dbName.isBlank()) {
            return;
        }
        if (Boolean.TRUE.equals(migratedSchemas.get(dbName))) {
            return;
        }

        try {
            Flyway.configure()
                    .dataSource(dataSource)
                    .locations("classpath:db/migration")
                    .baselineOnMigrate(true)
                    .baselineVersion("0")
                    .validateMigrationNaming(true)
                    .outOfOrder(false)
                    .load()
                    .migrate();
            migratedSchemas.put(dbName, Boolean.TRUE);
        } catch (RuntimeException ex) {
            migratedSchemas.remove(dbName);
            throw ex;
        }
    }

    private String resolveDatabaseName() {
        try {
            return jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        } catch (Exception ex) {
            return null;
        }
    }
}
