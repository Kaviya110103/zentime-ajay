package com.example.demo.tenant;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.example.demo.logging.RequestLogContext;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class TenantRoutingFilter extends OncePerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(TenantRoutingFilter.class);
    private final TenantResolverService tenantResolverService;
    private final boolean routingEnabled;

    public TenantRoutingFilter(
            TenantResolverService tenantResolverService,
            @Value("${tenant.routing.enabled:false}") boolean routingEnabled) {
        this.tenantResolverService = tenantResolverService;
        this.routingEnabled = routingEnabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!routingEnabled) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String tenantDb = tenantResolverService.resolveTenantDb(request);
            if (tenantDb != null && !tenantDb.isBlank()) {
                TenantContext.setTenantDb(tenantDb);
                RequestLogContext.setTenantDb(tenantDb);
                LOGGER.info("event=TENANT_RESOLVED correlationId={} method={} path={} clientId={} tenantDb={}",
                        RequestLogContext.correlationId(),
                        request.getMethod(),
                        RequestLogContext.sanitizePath(request.getRequestURI()),
                        request.getParameter("clientId"),
                        tenantDb);
            } else if (request.getParameter("clientId") != null || request.getHeader("X-Client-Id") != null) {
                LOGGER.warn("event=TENANT_RESOLUTION_FAILED correlationId={} method={} path={} clientId={}",
                        RequestLogContext.correlationId(),
                        request.getMethod(),
                        RequestLogContext.sanitizePath(request.getRequestURI()),
                        request.getParameter("clientId") == null ? request.getHeader("X-Client-Id") : request.getParameter("clientId"));
            }

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
