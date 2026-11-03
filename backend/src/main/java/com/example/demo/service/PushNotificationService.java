package com.example.demo.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.demo.MODELS.Announcement;
import com.example.demo.MODELS.AdminPushToken;
import com.example.demo.MODELS.AttendanceSupportRequest;
import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.EmployeePushToken;
import com.example.demo.MODELS.Holiday;
import com.example.demo.MODELS.LeavePermission;
import com.example.demo.repo.AdminPushTokenRepository;
import com.example.demo.repo.EmployeePushTokenRepository;
import com.example.demo.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class PushNotificationService {
    private static final Logger logger = LoggerFactory.getLogger(PushNotificationService.class);

    private final EmployeePushTokenRepository tokenRepository;
    private final AdminPushTokenRepository adminTokenRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${push.enabled:true}")
    private boolean pushEnabled;

    @Value("${push.expo.url:https://exp.host/--/api/v2/push/send}")
    private String expoPushUrl;

    public PushNotificationService(
            EmployeePushTokenRepository tokenRepository,
            AdminPushTokenRepository adminTokenRepository,
            ObjectMapper objectMapper) {
        this.tokenRepository = tokenRepository;
        this.adminTokenRepository = adminTokenRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newHttpClient();
    }

    public void registerToken(Employee employee, String token) {
        if (employee == null || employee.getId() == null || !isValidExpoToken(token)) {
            return;
        }
        if (tokenRepository.findByEmployeeIdAndToken(employee.getId(), token).isPresent()) {
            return;
        }
        EmployeePushToken entity = new EmployeePushToken();
        entity.setEmployee(employee);
        entity.setToken(token);
        tokenRepository.save(entity);
    }

    public void registerAdminToken(Long clientId, String token) {
        if (clientId == null || clientId <= 0 || !isValidExpoToken(token)) {
            return;
        }
        String previousTenantDb = TenantContext.getTenantDb();
        try {
            TenantContext.clear();
            if (adminTokenRepository.findByClientIdAndToken(clientId, token).isPresent()) {
                return;
            }
            AdminPushToken entity = new AdminPushToken();
            entity.setClientId(clientId);
            entity.setToken(token);
            adminTokenRepository.save(entity);
        } catch (RuntimeException ex) {
            logger.warn("Admin push token registration failed for clientId={}", clientId, ex);
        } finally {
            restoreTenantContext(previousTenantDb);
        }
    }

    public void notifyAnnouncement(Announcement announcement) {
        if (announcement == null) return;
        String title = announcement.getTitle() == null || announcement.getTitle().isBlank()
                ? "Announcement"
                : announcement.getTitle();
        String body = announcement.getMessage() == null ? "" : announcement.getMessage();
        Map<String, Object> data = Map.of(
                "type", "announcement",
                "announcementId", announcement.getId()
        );
        sendToTokens(tokenRepository.findAllTokens(), title, body, data);
    }

    public void notifyHolidayCreated(Holiday holiday) {
        if (holiday == null || holiday.getClientId() == null) return;
        String holidayName = holiday.getHolidayName() == null || holiday.getHolidayName().isBlank()
                ? "Holiday"
                : holiday.getHolidayName().trim();
        String holidayDate = holiday.getHolidayDate() == null
                ? ""
                : holiday.getHolidayDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String title = "Holiday Announced";
        String body = holidayDate.isBlank()
                ? "Holiday announced: " + holidayName
                : "Holiday announced: " + holidayName + " - " + holidayDate;
        Map<String, Object> data = Map.of(
                "type", "holiday",
                "holidayId", holiday.getId(),
                "clientId", holiday.getClientId(),
                "holidayDate", holiday.getHolidayDate() == null ? "" : holiday.getHolidayDate().toString(),
                "branchScope", holiday.getBranchScope() == null ? "ALL" : holiday.getBranchScope()
        );
        String branchScope = normalizeBranchScope(holiday.getBranchScope());
        List<String> tokens = "ALL".equals(branchScope)
                ? tokenRepository.findTokensByEmployeeClientId(holiday.getClientId())
                : tokenRepository.findTokensByEmployeeClientIdAndBranch(
                        holiday.getClientId(),
                        branchScope.toLowerCase(Locale.ROOT));
        sendToTokens(tokens, title, body, data);
    }

    public void notifyLeaveStatus(LeavePermission leave) {
        if (leave == null || leave.getEmployee() == null) return;
        String leaveType = leave.getLeaveType() == null ? "Leave" : leave.getLeaveType();
        String status = leave.getStatus() == null ? "updated" : leave.getStatus();
        String title = leaveType + " Status";
        String body = "Your " + leaveType + " request is " + status + ".";
        Map<String, Object> data = Map.of(
                "type", "leave_status",
                "leaveId", leave.getId(),
                "status", status
        );
        sendToEmployee(leave.getEmployee(), title, body, data);
    }

    public void notifyNewLeaveRequest(LeavePermission leave) {
        if (leave == null || leave.getEmployee() == null) return;
        Long clientId = leave.getEmployee().getClientId();
        if (clientId == null) return;

        String leaveType = leave.getLeaveType() == null || leave.getLeaveType().isBlank()
                ? "Leave"
                : leave.getLeaveType().trim();
        String employeeName = buildEmployeeName(leave.getEmployee());
        boolean isPermission = "permission".equalsIgnoreCase(leaveType);
        String title = leaveType + " Request";
        String body = isPermission
                ? employeeName + " requested permission on " + formatLeaveRequestDate(leave) + "."
                : employeeName + " requested " + leaveType + " for " + formatLeaveRequestDate(leave) + ".";
        Map<String, Object> data = Map.of(
                "type", "leave_request",
                "leaveId", leave.getId(),
                "clientId", clientId,
                "leaveType", leaveType,
                "requestDate", formatLeaveRequestDate(leave)
        );
        sendToTokens(findAdminTokensByClientId(clientId), title, body, data);
    }

    public void notifyNewSupportRequest(AttendanceSupportRequest request) {
        if (request == null || request.getEmployee() == null) return;
        Long clientId = request.getEmployee().getClientId();
        if (clientId == null) return;

        String employeeName = buildEmployeeName(request.getEmployee());
        String requestType = request.getRequestType() == null ? "" : request.getRequestType().trim();
        boolean attendanceRequest = requestType.equalsIgnoreCase("Attendance Support");
        String title = attendanceRequest ? "Attendance Request" : "Support Request";
        String body = attendanceRequest
                ? employeeName + " sent attendance request for " + formatSupportDate(request.getAttendanceDate()) + "."
                : employeeName + " sent support request.";
        Map<String, Object> data = Map.of(
                "type", "support_request",
                "supportRequestId", request.getId(),
                "clientId", clientId,
                "requestType", requestType.isBlank() ? "Support Request" : requestType
        );
        sendToTokens(findAdminTokensByClientId(clientId), title, body, data);
    }

    private List<String> findAdminTokensByClientId(Long clientId) {
        if (clientId == null || clientId <= 0) {
            return List.of();
        }
        String previousTenantDb = TenantContext.getTenantDb();
        try {
            TenantContext.clear();
            return adminTokenRepository.findTokensByClientId(clientId);
        } catch (RuntimeException ex) {
            logger.warn("Admin push token lookup failed for clientId={}", clientId, ex);
            return List.of();
        } finally {
            restoreTenantContext(previousTenantDb);
        }
    }

    private void restoreTenantContext(String tenantDb) {
        if (tenantDb == null || tenantDb.isBlank()) {
            TenantContext.clear();
        } else {
            TenantContext.setTenantDb(tenantDb);
        }
    }

    public void notifyLogin(Employee employee) {
        if (employee == null) return;
        String name = employee.getFirstName() == null || employee.getFirstName().isBlank()
                ? "Employee"
                : employee.getFirstName();
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        String title = "Login Time";
        String body = "Hi " + name + ", you logged in at " + timestamp + ".";
        Map<String, Object> data = Map.of(
                "type", "login",
                "employeeId", employee.getId()
        );
        sendToEmployee(employee, title, body, data);
    }

    public void sendTest(Employee employee, String title, String body) {
        if (employee == null) return;
        String safeTitle = (title == null || title.isBlank()) ? "Test Notification" : title;
        String safeBody = (body == null) ? "" : body;
        Map<String, Object> data = Map.of(
                "type", "test",
                "employeeId", employee.getId()
        );
        sendToEmployee(employee, safeTitle, safeBody, data);
    }

    private void sendToEmployee(Employee employee, String title, String body, Map<String, Object> data) {
        if (employee == null || employee.getId() == null) return;
        List<EmployeePushToken> tokens = tokenRepository.findByEmployeeId(employee.getId());
        List<String> tokenStrings = new ArrayList<>();
        for (EmployeePushToken token : tokens) {
            tokenStrings.add(token.getToken());
        }
        sendToTokens(tokenStrings, title, body, data);
    }

    private void sendToTokens(List<String> tokens, String title, String body, Map<String, Object> data) {
        if (!pushEnabled || tokens == null || tokens.isEmpty()) {
            return;
        }

        Set<String> uniqueTokens = new HashSet<>();
        for (String token : tokens) {
            if (isValidExpoToken(token)) {
                uniqueTokens.add(token);
            }
        }
        if (uniqueTokens.isEmpty()) {
            return;
        }

        List<Map<String, Object>> payloads = new ArrayList<>();
        for (String token : uniqueTokens) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("to", token);
            payload.put("title", title);
            payload.put("body", body);
            payload.put("sound", "default");
            payload.put("priority", "high");
            payload.put("channelId", "zentime");
            if (data != null && !data.isEmpty()) {
                payload.put("data", data);
            }
            payloads.add(payload);
        }

        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(payloads);
        } catch (JsonProcessingException e) {
            logger.warn("Failed to serialize push payload.", e);
            return;
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create(expoPushUrl))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                logger.warn("Push notification failed: status={}, body={}", response.statusCode(), response.body());
            }
        } catch (IOException | InterruptedException e) {
            logger.warn("Push notification request failed.", e);
            Thread.currentThread().interrupt();
        }
    }

    private boolean isValidExpoToken(String token) {
        if (token == null) return false;
        if (!token.endsWith("]")) return false;
        return token.startsWith("ExpoPushToken[") || token.startsWith("ExponentPushToken[");
    }

    private String buildEmployeeName(Employee employee) {
        if (employee == null) {
            return "Employee";
        }
        String firstName = employee.getFirstName() == null ? "" : employee.getFirstName().trim();
        String lastName = employee.getLastName() == null ? "" : employee.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        if (!fullName.isBlank()) {
            return fullName;
        }
        if (employee.getUsername() != null && !employee.getUsername().isBlank()) {
            return employee.getUsername().trim();
        }
        return "Employee";
    }

    private String formatLeaveRequestDate(LeavePermission leave) {
        LocalDate start = parseFlexibleDate(leave == null ? null : leave.getStartDate());
        LocalDate end = parseFlexibleDate(leave == null ? null : leave.getEndDate());
        if (start == null) {
            start = parseFlexibleDate(leave == null ? null : leave.getDate());
        }
        if (start == null) {
            return "the selected date";
        }

        String startText = start.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        if (end == null || end.equals(start)) {
            return startText;
        }
        return startText + " to " + end.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private String formatSupportDate(LocalDate date) {
        if (date == null) {
            return "the selected date";
        }
        return date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private LocalDate parseFlexibleDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        DateTimeFormatter[] formatters = new DateTimeFormatter[] {
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ofPattern("d/M/yyyy")
        };
        for (DateTimeFormatter formatter : formatters) {
            try {
                return LocalDate.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
                // Try next supported date format.
            }
        }
        return null;
    }

    private String normalizeBranchScope(String branchScope) {
        if (branchScope == null || branchScope.isBlank()) {
            return "ALL";
        }
        String value = branchScope.trim();
        return "ALL".equalsIgnoreCase(value) || "All Branches".equalsIgnoreCase(value) ? "ALL" : value;
    }
}
