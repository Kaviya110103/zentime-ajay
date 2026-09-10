package com.example.demo.logging;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.example.demo.tenant.TenantContext;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {
    public static final String CORRELATION_HEADER = "X-Correlation-ID";
    private static final Logger LOGGER = LoggerFactory.getLogger(RequestLoggingFilter.class);
    private static final Pattern SAFE_CORRELATION_ID = Pattern.compile("[A-Za-z0-9._-]{1,128}");

    private final long slowRequestThresholdMs;

    public RequestLoggingFilter(
            @Value("${app.logging.slow-request-threshold-ms:1000}") long slowRequestThresholdMs) {
        this.slowRequestThresholdMs = slowRequestThresholdMs;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        long started = System.nanoTime();
        String correlationId = resolveCorrelationId(request);
        String path = RequestLogContext.sanitizePath(request.getRequestURI());
        String clientId = firstPresent(
                request.getParameter("clientId"),
                request.getHeader("X-Client-Id"),
                request.getHeader("clientId"));
        String employeeId = firstPresent(
                request.getParameter("employeeId"),
                request.getParameter("id"));

        MDC.put(RequestLogContext.CORRELATION_ID, correlationId);
        MDC.remove(RequestLogContext.TENANT_DB);
        response.setHeader(CORRELATION_HEADER, correlationId);

        Throwable failure = null;
        try {
            filterChain.doFilter(request, response);
        } catch (Throwable ex) {
            failure = ex;
            throw ex;
        } finally {
            long durationMs = (System.nanoTime() - started) / 1_000_000L;
            int status = response.getStatus();
            String tenantDb = firstPresent(TenantContext.getTenantDb(), RequestLogContext.tenantDb());
            String event = durationMs >= slowRequestThresholdMs ? "SLOW_REQUEST" : "REQUEST_COMPLETED";

            if (failure == null) {
                LOGGER.info(
                        "event={} correlationId={} method={} path={} status={} durationMs={} clientId={} employeeId={} tenantDb={}",
                        event,
                        correlationId,
                        request.getMethod(),
                        path,
                        status,
                        durationMs,
                        clientId,
                        employeeId,
                        tenantDb);
            } else {
                LOGGER.error(
                        "event=REQUEST_EXCEPTION correlationId={} method={} path={} status={} durationMs={} clientId={} employeeId={} tenantDb={} exceptionClass={} message={}",
                        correlationId,
                        request.getMethod(),
                        path,
                        status,
                        durationMs,
                        clientId,
                        employeeId,
                        tenantDb,
                        failure.getClass().getName(),
                        failure.getMessage(),
                        failure);
            }
            MDC.remove(RequestLogContext.CORRELATION_ID);
            MDC.remove(RequestLogContext.TENANT_DB);
        }
    }

    private String resolveCorrelationId(HttpServletRequest request) {
        String supplied = request.getHeader(CORRELATION_HEADER);
        if (supplied != null) {
            String trimmed = supplied.trim();
            if (SAFE_CORRELATION_ID.matcher(trimmed).matches()) {
                return trimmed;
            }
        }
        return UUID.randomUUID().toString();
    }

    private String firstPresent(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
