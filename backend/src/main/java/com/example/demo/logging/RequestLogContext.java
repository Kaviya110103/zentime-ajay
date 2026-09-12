package com.example.demo.logging;

import org.slf4j.MDC;

public final class RequestLogContext {
    public static final String CORRELATION_ID = "correlationId";
    public static final String TENANT_DB = "tenantDb";

    private RequestLogContext() {
    }

    public static String correlationId() {
        return MDC.get(CORRELATION_ID);
    }

    public static void setTenantDb(String tenantDb) {
        if (tenantDb == null || tenantDb.isBlank()) {
            MDC.remove(TENANT_DB);
        } else {
            MDC.put(TENANT_DB, tenantDb);
        }
    }

    public static String tenantDb() {
        return MDC.get(TENANT_DB);
    }

    public static String sanitizePath(String path) {
        if (path == null) {
            return null;
        }
        if (path.startsWith("/api/employees/details/")) {
            String prefix = "/api/employees/details/";
            String remainder = path.substring(prefix.length());
            String[] parts = remainder.split("/", -1);
            if (parts.length >= 2) {
                return prefix + parts[0] + "/[REDACTED]";
            }
            return prefix + "[REDACTED]";
        }
        return path;
    }
}
