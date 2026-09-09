package com.example.demo.controller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.MODELS.AttendanceRecord;
import com.example.demo.MODELS.Employee;
import com.example.demo.repo.AttendanceRecordRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.service.AttendanceClassificationService;
import com.example.demo.service.AttendanceMetricsService;
import com.example.demo.service.EmployeeService;
import com.example.demo.service.AttendanceSchedulerService;

import java.util.HashMap;
import java.util.Map;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Comparator;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/attendance-records")
@CrossOrigin(origins = "*")

public class AttendanceRecordControllerFillter {

    private static final Logger LOGGER = LoggerFactory.getLogger(AttendanceRecordControllerFillter.class);

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private AttendanceMetricsService attendanceMetricsService;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AttendanceSchedulerService attendanceSchedulerService;

    @Autowired
    private AttendanceClassificationService attendanceClassificationService;

    private void safeSyncRecords(List<AttendanceRecord> records) {
        try {
            attendanceMetricsService.synchronizeMissedMinutes(records);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    private void safeSyncRecord(AttendanceRecord record) {
        try {
            attendanceMetricsService.synchronizeMissedMinutes(record);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    private void applyResponseMissedTimes(List<AttendanceRecord> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        for (AttendanceRecord record : records) {
            applyResponseMissedTimes(record);
        }
    }

    private void applyResponseMissedTimes(AttendanceRecord record) {
        if (record == null || record.getTimeIn() == null || record.getTimeOut() == null) {
            return;
        }
        try {
            if (attendanceMetricsService.hasAdditionalShiftWindow(record)) {
                record.setMissedTimes(attendanceMetricsService.calculateDailyMissedMinutes(record));
            }
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAttendanceRecord(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> payload,
            @RequestParam(value = "clientId", required = false) String clientIdRaw) {
        try {
            Long clientId = parseLongOrNull(clientIdRaw);
            Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            AttendanceRecord record = optional.get();
            if (clientId != null
                    && (record.getEmployee() == null || !clientId.equals(record.getEmployee().getClientId()))) {
                return ResponseEntity.status(403).body(Map.of("message", "Attendance record does not belong to this client."));
            }

            if (payload == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "Request body is required."));
            }
            if (payload.containsKey("date")) {
                record.setDate(asText(payload.get("date")));
            }
            if (payload.containsKey("timeIn")) {
                record.setTimeIn(parseDateTime(payload.get("timeIn"), record.getDate()));
            }
            if (payload.containsKey("timeOut")) {
                record.setTimeOut(parseDateTime(payload.get("timeOut"), record.getDate()));
            }
            if (payload.containsKey("attendanceStatus")) {
                record.setAttendanceStatus(asText(payload.get("attendanceStatus")));
            }
            if (payload.containsKey("dayStatus")) {
                record.setDayStatus(asText(payload.get("dayStatus")));
            }
            if (payload.containsKey("location")) {
                record.setLocation(asText(payload.get("location")));
            }
            if (payload.containsKey("missedTimes")) {
                record.setMissedTimes(asInteger(payload.get("missedTimes")));
            }
            if (payload.containsKey("overtime")) {
                record.setOvertime(asDouble(payload.get("overtime")));
            }
            if (payload.containsKey("permissionUsed")) {
                record.setPermissionUsed(asDouble(payload.get("permissionUsed")));
            }

            updateWorkedHours(record);
            AttendanceRecord saved = attendanceRecordRepository.save(record);
            if (!payload.containsKey("missedTimes")) {
                safeSyncRecord(saved);
            }
            return ResponseEntity.ok(saved);
        } catch (Exception ex) {
            ex.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("message", ex.getMessage() == null ? "Unable to update attendance record." : ex.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAttendanceRecord(
            @PathVariable("id") Long id,
            @RequestParam(value = "clientId", required = false) String clientIdRaw) {
        Long clientId = parseLongOrNull(clientIdRaw);
        Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(id);
        if (optional.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        AttendanceRecord record = optional.get();
        if (clientId != null
                && (record.getEmployee() == null || !clientId.equals(record.getEmployee().getClientId()))) {
            return ResponseEntity.status(403).body("Attendance record does not belong to this client.");
        }

        attendanceRecordRepository.delete(record);
        return ResponseEntity.ok(Map.of("deleted", true, "id", id));
    }

    // 1. Get all attendance details
    @GetMapping("/all")
    public ResponseEntity<?> getAllAttendanceRecords(
            @RequestParam(value = "clientId", required = false) Long clientId,
            @RequestParam(value = "limit", defaultValue = "200") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        try {
            List<Object[]> rows = attendanceRecordRepository.findAttendanceRecordRows(
                    clientId, PageRequest.of(0, safeLimit));
            List<Map<String, Object>> records = rows.stream().map(this::toAttendanceRecordMap).toList();
            return ResponseEntity.ok(attendanceClassificationService.classifyRecordMaps(records, clientId));
        } catch (Exception ex) {
            ex.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("message", "Unable to fetch attendance records."));
        }
    }

    private Map<String, Object> toAttendanceRecordMap(AttendanceRecord source) {
        Map<String, Object> record = new HashMap<>();
        record.put("id", source.getId());
        record.put("timeIn", source.getTimeIn());
        record.put("timeOut", source.getTimeOut());
        record.put("dayStatus", source.getDayStatus());
        record.put("location", source.getLocation());
        record.put("attendanceStatus", source.getAttendanceStatus());
        record.put("date", source.getDate());
        record.put("missedTimes", source.getMissedTimes());
        record.put("workedHours", source.getWorkedHours());
        record.put("overtime", source.getOvertime());
        record.put("permissionUsed", source.getPermissionUsed());
        record.put("shiftId", source.getShiftId());

        Employee employeeSource = source.getEmployee();
        record.put("employeeId", employeeSource == null ? null : employeeSource.getId());
        Map<String, Object> employee = new HashMap<>();
        if (employeeSource != null) {
            employee.put("id", employeeSource.getId());
            employee.put("employeeId", employeeSource.getId());
            employee.put("firstName", employeeSource.getFirstName());
            employee.put("lastName", employeeSource.getLastName());
            employee.put("branch", employeeSource.getBranch());
            employee.put("employeeCode", employeeSource.getEmployeeCode());
            employee.put("weekOff", employeeSource.getWeekOff());
            employee.put("shiftStartTime", employeeSource.getShiftStartTime());
            employee.put("shiftEndTime", employeeSource.getShiftEndTime());
            employee.put("leavePolicyType", employeeSource.getLeavePolicyType());
        }
        record.put("employee", employee);
        return record;
    }

    private Map<String, Object> toAttendanceRecordMap(Object[] row) {
        Map<String, Object> record = new HashMap<>();
        record.put("id", row[0]);
        record.put("timeIn", row[1]);
        record.put("timeOut", row[2]);
        record.put("dayStatus", row[3]);
        record.put("location", row[4]);
        record.put("attendanceStatus", row[5]);
        record.put("date", row[6]);
        record.put("missedTimes", row[7]);
        record.put("workedHours", row[8]);
        record.put("overtime", row[9]);
        record.put("permissionUsed", row[10]);
        record.put("shiftId", row[11]);
        record.put("employeeId", row[12]);

        Map<String, Object> employee = new HashMap<>();
        employee.put("id", row[12]);
        employee.put("employeeId", row[12]);
        employee.put("firstName", row[13]);
        employee.put("lastName", row[14]);
        employee.put("branch", row[15]);
        employee.put("employeeCode", row[16]);
        employee.put("weekOff", row[17]);
        employee.put("shiftStartTime", row[18]);
        employee.put("shiftEndTime", row[19]);
        employee.put("leavePolicyType", row[20]);
        if (row.length > 21) {
            record.put("expectedShiftStart", row[21]);
        }
        if (row.length > 22) {
            record.put("expectedShiftEnd", row[22]);
        }
        if (row.length > 23) {
            record.put("expectedMinutes", row[23]);
        }
        if (row.length > 24) {
            record.put("shiftSource", row[24]);
        }
        record.put("employee", employee);
        return record;
    }

    private List<Object[]> findSearchRowsNoDates(
            Long clientId,
            Long employeeId,
            String branch,
            Pageable pageable) {
        if (clientId != null) {
            if (employeeId != null && branch != null) {
                return attendanceRecordRepository.findAttendanceRecordRowsByClientEmployeeAndBranchForSearch(
                        clientId, employeeId, branch, pageable);
            }
            if (employeeId != null) {
                return attendanceRecordRepository.findAttendanceRecordRowsByClientAndEmployeeForSearch(
                        clientId, employeeId, pageable);
            }
            if (branch != null) {
                return attendanceRecordRepository.findAttendanceRecordRowsByClientAndBranchForSearch(
                        clientId, branch, pageable);
            }
            return attendanceRecordRepository.findAttendanceRecordRows(clientId, pageable);
        }
        return attendanceRecordRepository.findAttendanceRecordRowsForSearch(
                null, employeeId, branch, List.of(""), true, pageable);
    }

    private List<Object[]> findSearchRowsByDates(
            Long clientId,
            Long employeeId,
            String branch,
            List<String> dates,
            Pageable pageable) {
        if (clientId != null) {
            if (employeeId != null && branch != null) {
                return attendanceRecordRepository.findAttendanceRecordRowsByClientEmployeeBranchAndDatesForSearch(
                        clientId, employeeId, branch, dates, pageable);
            }
            if (employeeId != null) {
                return attendanceRecordRepository.findAttendanceRecordRowsByClientEmployeeAndDatesForSearch(
                        clientId, employeeId, dates, pageable);
            }
            if (branch != null) {
                return attendanceRecordRepository.findAttendanceRecordRowsByClientBranchAndDatesForSearch(
                        clientId, branch, dates, pageable);
            }
            return attendanceRecordRepository.findAttendanceRecordRowsByClientAndDatesForSearch(
                    clientId, dates, pageable);
        }
        return attendanceRecordRepository.findAttendanceRecordRowsForSearch(
                null, employeeId, branch, dates, false, pageable);
    }

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public ResponseEntity<?> searchAttendanceRecords(
            @RequestParam(value = "clientId", required = false) Long clientId,
            @RequestParam(value = "employeeId", required = false) String employeeRef,
            @RequestParam(value = "branch", required = false) String branch,
            @RequestParam(value = "date", required = false) String date,
            @RequestParam(value = "startDate", required = false) String startDate,
            @RequestParam(value = "endDate", required = false) String endDate,
            @RequestParam(value = "month", required = false) Integer month,
            @RequestParam(value = "year", required = false) Integer year,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "limit", defaultValue = "500") int limit) {
        try {
            Long employeeId = null;
            Employee selectedEmployee = null;
            if (employeeRef != null && !employeeRef.isBlank()) {
                Optional<Employee> employee = resolveEmployeeByRef(employeeRef, clientId);
                if (employee.isEmpty()) {
                    return ResponseEntity.ok(List.of());
                }
                selectedEmployee = employee.get();
                employeeId = selectedEmployee.getId();
            }

            DateRange range = resolveDateRange(date, startDate, endDate, month, year);
            int safePage = Math.max(0, page);
            int safeLimit = Math.max(1, Math.min(limit, 5000));
            String normalizedBranch = normalizeBranch(branch);

            List<Map<String, Object>> classified;
            if (range != null) {
                classified = searchCalendarBackedRecords(clientId, selectedEmployee, normalizedBranch, range);
            } else {
                List<Object[]> rows = findSearchRowsNoDates(
                        clientId,
                        employeeId,
                        normalizedBranch,
                        PageRequest.of(safePage, safeLimit));
                List<Map<String, Object>> records = rows.stream().map(this::toAttendanceRecordMap).toList();
                classified = attendanceClassificationService.classifyRecordMaps(records, clientId);
            }

            List<Map<String, Object>> statusFiltered = new ArrayList<>(filterByClassifiedStatus(classified, status));
            statusFiltered.sort(this::compareRecordMapsNewestFirst);
            int fromIndex = Math.min(safePage * safeLimit, statusFiltered.size());
            int toIndex = Math.min(fromIndex + safeLimit, statusFiltered.size());
            return ResponseEntity.ok(statusFiltered.subList(fromIndex, toIndex));
        } catch (Exception ex) {
            LOGGER.error(
                    "Attendance records search failed clientId={} employeeRef={} branch={} date={} startDate={} endDate={} month={} year={} status={} page={} limit={}",
                    clientId,
                    employeeRef,
                    branch,
                    date,
                    startDate,
                    endDate,
                    month,
                    year,
                    status,
                    page,
                    limit,
                    ex);
            return ResponseEntity.internalServerError().body(Map.of("message", "Unable to search attendance records."));
        }
    }

    // 2. Get attendance details by employee ID
    @GetMapping("/by-employee")
    public List<Map<String, Object>> getAttendanceByEmployeeId(
            @RequestParam("employeeId") String employeeId,
            @RequestParam(value = "clientId", required = false) Long clientId,
            @RequestParam(value = "limit", defaultValue = "200") int limit) {
        Optional<Employee> employee = resolveEmployeeByRef(employeeId);
        if (employee.isEmpty()) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeIdOrderByIdDesc(
                employee.get().getId(), PageRequest.of(0, safeLimit));
        applyResponseMissedTimes(records);
        return attendanceClassificationService.classifyRecords(records, clientId);
    }

    // 3. Get attendance details by month and employee ID
    @GetMapping("/by-employee-month")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAttendanceByEmployeeIdAndMonth(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("month") int month,
            @RequestParam("year") int year,
            @RequestParam(value = "clientId", required = false) Long clientId) {
        Long resolvedEmployeeId = null;
        try {
            Optional<Employee> employee = resolveEmployeeByRef(employeeId);
            if (employee.isEmpty()) {
                return List.of();
            }
            resolvedEmployeeId = employee.get().getId();
            YearMonth yearMonth = YearMonth.of(year, month);
            LocalDate from = yearMonth.atDay(1);
            LocalDate to = yearMonth.atEndOfMonth();
            List<String> monthDateCandidates = buildMonthDateCandidates(yearMonth);
            List<AttendanceRecord> monthlyRecords = attendanceRecordRepository.findByEmployeeIdAndDatesWithEmployee(
                    resolvedEmployeeId, monthDateCandidates, clientId);

            Map<LocalDate, Map<String, Object>> recordsByDate = new LinkedHashMap<>();
            for (AttendanceRecord record : monthlyRecords) {
                LocalDate recordDate = parseFlexibleDate(record.getDate());
                if (recordDate == null || recordDate.isBefore(from) || recordDate.isAfter(to)) {
                    continue;
                }
                Map<String, Object> current = toAttendanceRecordMap(record);
                Map<String, Object> existing = recordsByDate.get(recordDate);
                if (shouldReplaceMonthlyRecord(existing, current)) {
                    recordsByDate.put(recordDate, current);
                }
            }

            List<Map<String, Object>> calendarRows = attendanceClassificationService.classifyCalendar(
                    employee.get(), from, to, clientId);
            List<Map<String, Object>> mergedRows = new ArrayList<>();
            for (Map<String, Object> calendarRow : calendarRows) {
                LocalDate recordDate = parseFlexibleDate(asText(calendarRow.get("date")));
                Map<String, Object> actualRow = recordDate == null ? null : recordsByDate.get(recordDate);
                if (actualRow == null) {
                    mergedRows.add(calendarRow);
                    continue;
                }
                Map<String, Object> merged = new LinkedHashMap<>(calendarRow);
                merged.putAll(actualRow);
                merged.put("date", calendarRow.get("date"));
                merged.put("employeeId", calendarRow.get("employeeId"));
                merged.put("employee", calendarRow.get("employee"));
                mergedRows.add(merged);
            }

            return attendanceClassificationService.classifyRecordMaps(mergedRows, clientId);
        } catch (Exception ex) {
            LOGGER.error(
                    "Monthly attendance report failed employeeRef={} resolvedEmployeeId={} clientId={} month={} year={}",
                    employeeId,
                    resolvedEmployeeId,
                    clientId,
                    month,
                    year,
                    ex);
            throw ex;
        }
    }

    @GetMapping("/by-employee-month-metrics")
    public ResponseEntity<?> getAttendanceMetricsByEmployeeIdAndMonth(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("month") int month,
            @RequestParam("year") int year) {
        Optional<Employee> employee = resolveEmployeeByRef(employeeId);
        if (employee.isEmpty()) {
            Map<String, Object> emptyResponse = new HashMap<>();
            emptyResponse.put("employeeId", employeeId);
            emptyResponse.put("month", month);
            emptyResponse.put("year", year);
            emptyResponse.put("absentCount", 0);
            emptyResponse.put("presentCount", 0);
            emptyResponse.put("workingDays", 0);
            emptyResponse.put("totalLateMinutes", 0);
            emptyResponse.put("totalEarlyOutMinutes", 0);
            emptyResponse.put("totalMissedTimes", 0);
            emptyResponse.put("lateDays", 0);
            emptyResponse.put("approvedPermissionCount", 0);
            emptyResponse.put("approvedPermissionMinutes", 0);
            emptyResponse.put("maxPermissionsPerMonth", AttendanceMetricsService.MAX_APPROVED_PERMISSIONS_PER_MONTH);
            emptyResponse.put("maxPermissionMinutesPerMonth", AttendanceMetricsService.MAX_APPROVED_PERMISSION_MINUTES_PER_MONTH);
            return ResponseEntity.ok(emptyResponse);
        }

        Long resolvedEmployeeId = employee.get().getId();
        AttendanceMetricsService.MonthlyMetrics metrics =
                attendanceMetricsService.calculateMonthlyMetrics(resolvedEmployeeId, month, year);

        Map<String, Object> response = new HashMap<>();
        response.put("employeeId", resolvedEmployeeId);
        response.put("month", month);
        response.put("year", year);
        response.put("absentCount", metrics.absentCount());
        response.put("presentCount", metrics.presentCount());
        response.put("workingDays", metrics.presentCount());
        response.put("lateDays", metrics.monthlyLateDays());
        response.put("totalLateMinutes", metrics.monthlyLateMinutes());
        response.put("totalEarlyOutMinutes", metrics.monthlyEarlyOutMinutes());
        response.put("totalMissedTimes", metrics.totalMissedMinutes());
        response.put("approvedPermissionCount", metrics.approvedPermissionCount());
        response.put("approvedPermissionMinutes", metrics.approvedPermissionMinutes());
        response.put("maxPermissionsPerMonth", attendanceMetricsService.resolveMaxApprovedPermissionsPerMonth(employee.get()));
        response.put("maxPermissionMinutesPerMonth", attendanceMetricsService.resolveMaxApprovedPermissionMinutesPerMonth(employee.get()));
        return ResponseEntity.ok(response);
    }

    // 4. Get attendance details by date and employee ID
    @GetMapping("/by-employee-date")
    public ResponseEntity<?> getAttendanceByEmployeeIdAndDate(
            @RequestParam("employeeId") String employeeId,
            @RequestParam("date") String date,
            @RequestParam(value = "clientId", required = false) Long clientId) {
        Optional<Employee> employee = resolveEmployeeByRef(employeeId);
        if (employee.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        LocalDate targetDate = parseFlexibleDate(date);
        if (targetDate == null) {
            return ResponseEntity.ok(List.of());
        }

        List<String> dateCandidates = List.of(
                targetDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                targetDate.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
                targetDate.format(DateTimeFormatter.ofPattern("dd-MM-yyyy")));
        List<Map<String, Object>> records = attendanceRecordRepository
                .findAttendanceRecordRowsByEmployeeAndDates(employee.get().getId(), dateCandidates, clientId)
                .stream()
                .map(this::toAttendanceRecordMap)
                .toList();

        if (records.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        if (records.size() == 1) {
            return ResponseEntity.ok(attendanceClassificationService.classifyRecordMaps(records, clientId).stream()
                    .findFirst()
                    .orElseGet(HashMap::new));
        }

        return ResponseEntity.ok(attendanceClassificationService.classifyRecordMaps(records, clientId));
    }

    // 5. Get attendance details by employee branch
    @GetMapping("/by-branch")
    public List<Map<String, Object>> getAttendanceByBranch(
            @RequestParam("branch") String branch,
            @RequestParam(value = "clientId", required = false) Long clientId) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeBranch(branch);
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return attendanceClassificationService.classifyRecords(records, clientId);
    }

    // 6. Get all details by particular month and particular date for all employees
    @GetMapping("/by-month-date")
    public List<AttendanceRecord> getAttendanceByMonthAndDate(
            @RequestParam("month") int month,
            @RequestParam("year") int year,
            @RequestParam("date") String date) {
        List<AttendanceRecord> records = attendanceRecordRepository.findAll()
                .stream()
                .filter(record -> isRecordInMonth(record, month, year))
                .filter(record -> {
                    LocalDate recordDate = parseFlexibleDate(record.getDate());
                    LocalDate targetDate = parseFlexibleDate(date);
                    if (recordDate == null || targetDate == null) {
                        return false;
                    }
                    return recordDate.equals(targetDate);
                })
                .toList();
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }

    // 7. Get all attendance details by date and attendance status (Present/Absent)
    @GetMapping("/by-date-status")
    public List<AttendanceRecord> getAttendanceByDateAndStatus(
            @RequestParam("date") String date,
            @RequestParam("attendanceStatus") String attendanceStatus) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByDateAndAttendanceStatus(date, attendanceStatus);
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }
    @GetMapping("/branches")
public List<String> getAllBranches() {
    return attendanceRecordRepository.findAllDistinctBranches();
}

@PutMapping("/calculate-missed-times")
public ResponseEntity<?> calculateAndUpdateMissedTimes(@RequestParam("attendanceId") Long attendanceId) {
    Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(attendanceId);
    if (optional.isEmpty()) {
        return ResponseEntity.status(404).body("Attendance record not found.");
    }
    AttendanceRecord record = optional.get();

    if (record.getTimeIn() != null && record.getTimeOut() != null) {
        employeeService.updateMissedTimes(record);
        return ResponseEntity.ok("Missed times calculated and updated: " + record.getMissedTimes() + " minutes.");
    } else {
        return ResponseEntity.badRequest().body("Both timeIn and timeOut must be set to calculate missed times.");
    }
}
@PutMapping("/calculate-missed-times-all")
public ResponseEntity<?> calculateMissedTimesForAll() {
    List<AttendanceRecord> records = attendanceRecordRepository.findAll();
    int updatedCount = 0;

    for (AttendanceRecord record : records) {
        if (record.getTimeIn() != null && record.getTimeOut() != null) {
            employeeService.updateMissedTimes(record);
            updatedCount++;
        }
    }
    return ResponseEntity.ok("Missed times calculated and updated for " + updatedCount + " records.");
}

@PutMapping("/upload-both-images-all")
public ResponseEntity<?> uploadBothImagesForAll(@RequestParam("file") MultipartFile file) {
    try {
        byte[] imageBytes = file.getBytes();
        List<AttendanceRecord> records = attendanceRecordRepository.findAll();
        for (AttendanceRecord record : records) {
            record.setImageIn(imageBytes);
            record.setImageOut(imageBytes);
        }
        attendanceRecordRepository.saveAll(records);
        return ResponseEntity.ok("Both images uploaded for all attendance records.");
    } catch (Exception e) {
        return ResponseEntity.status(500).body("Failed to upload images for all records.");
    }
}

@GetMapping("/by-status-month")
    public List<AttendanceRecord> getAttendanceByStatusAndMonth(
            @RequestParam("attendanceStatus") String attendanceStatus,
            @RequestParam("month") int month,
            @RequestParam("year") int year) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByAttendanceStatus(attendanceStatus)
                .stream()
                .filter(record -> isRecordInMonth(record, month, year))
                .toList();
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }

@GetMapping("/by-month-status-branch")
    public List<AttendanceRecord> getAttendanceByMonthStatusBranch(
            @RequestParam("month") int month,
            @RequestParam("year") int year,
            @RequestParam("attendanceStatus") String attendanceStatus,
            @RequestParam("branch") String branch) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByAttendanceStatus(attendanceStatus)
                .stream()
                .filter(record -> isRecordInMonth(record, month, year))
                .filter(record -> record.getEmployee() != null
                        && record.getEmployee().getBranch() != null
                        && record.getEmployee().getBranch().equalsIgnoreCase(branch))
                .toList();
        safeSyncRecords(records);
        applyResponseMissedTimes(records);
        return records;
    }



@GetMapping("/check-today-attendance")
    public ResponseEntity<?> checkTodayAttendance(@RequestParam("employeeId") String employeeId) {
    Optional<Employee> employee = resolveEmployeeByRef(employeeId);
    if (employee.isEmpty()) {
        return ResponseEntity.ok("Employee not found.");
    }

    LocalDate today = java.time.LocalDate.now();
    List<String> candidates = List.of(
            today.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")),
            today.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd")),
            today.format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy"))
    );
    List<AttendanceRecord> records = new ArrayList<>();
    for (String candidate : candidates) {
        records = attendanceRecordRepository.findByEmployeeIdAndDate(employee.get().getId(), candidate);
        if (!records.isEmpty()) {
            break;
        }
    }

    if (records.isEmpty()) {
        return ResponseEntity.ok("No attendance for today!");
    }

    AttendanceRecord record = records.get(0); // Assuming one record per day per employee

    if ("Absent".equalsIgnoreCase(record.getAttendanceStatus())) {
        return ResponseEntity.ok("Absent today!");
    }
    if (!"Present".equalsIgnoreCase(record.getAttendanceStatus())) {
        return ResponseEntity.ok("Not marked as present today!");
    }
    if (record.getTimeIn() == null) {
        return ResponseEntity.ok("Time-in not marked!");
    }
    if (record.getTimeOut() == null) {
        return ResponseEntity.ok("Time-out not marked!");
    }
    if (record.getDayStatus() == null || !"Completed".equalsIgnoreCase(record.getDayStatus())) {
        return ResponseEntity.ok("Day not closed!");
    }
    return ResponseEntity.ok("Attendance complete for today.");
}
// Get attendance details of all employees for a particular date
@GetMapping("/by-date")
public List<Map<String, Object>> getAttendanceByDate(
        @RequestParam("date") String date,
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 200));
    List<AttendanceRecord> records = clientId == null
            ? attendanceRecordRepository.findByDateOrderByIdDesc(date, PageRequest.of(0, safeLimit))
            : attendanceRecordRepository.findByDateAndEmployee_ClientIdOrderByIdDesc(date, clientId, PageRequest.of(0, safeLimit));
    safeSyncRecords(records);
    applyResponseMissedTimes(records);
    return attendanceClassificationService.classifyRecords(records, clientId);
}

private Optional<Employee> resolveEmployeeByRef(String employeeRef) {
    if (employeeRef == null || employeeRef.isBlank()) {
        return Optional.empty();
    }

    String normalized = employeeRef.trim();
    try {
        return employeeRepository.findById(Long.parseLong(normalized));
    } catch (NumberFormatException ignored) {
        // Continue with employee-code lookup.
    }

    Optional<Employee> byCode = employeeRepository.findByEmployeeCode(normalized.toUpperCase());
    if (byCode.isPresent()) {
        return byCode;
    }

    Matcher matcher = Pattern.compile("(?i)(?:^|\\.)EMP(\\d+)$").matcher(normalized);
    if (matcher.find()) {
        try {
            return employeeRepository.findById(Long.parseLong(matcher.group(1)));
        } catch (NumberFormatException ignored) {
            // Keep empty below.
        }
    }

    return Optional.empty();
}

private Optional<Employee> resolveEmployeeByRef(String employeeRef, Long clientId) {
    Optional<Employee> employee = resolveEmployeeByRef(employeeRef);
    if (employee.isEmpty() || clientId == null) {
        return employee;
    }
    return clientId.equals(employee.get().getClientId()) ? employee : Optional.empty();
}

private List<Map<String, Object>> searchCalendarBackedRecords(
        Long clientId,
        Employee selectedEmployee,
        String branch,
        DateRange range) {
    List<Employee> employees = resolveEmployeesForCalendar(clientId, selectedEmployee, branch);
    if (employees.isEmpty()) {
        return List.of();
    }

    List<String> dateCandidates = buildDateCandidates(range.start(), range.end());
    Long employeeId = selectedEmployee == null ? null : selectedEmployee.getId();
    List<Object[]> rows = findSearchRowsByDates(
            clientId,
            employeeId,
            branch,
            dateCandidates,
            PageRequest.of(0, 100000));

    Map<String, Map<String, Object>> actualByEmployeeDate = new LinkedHashMap<>();
    for (Object[] row : rows) {
        Map<String, Object> record = toAttendanceRecordMap(row);
        Long rowEmployeeId = asLong(record.get("employeeId"));
        LocalDate recordDate = parseFlexibleDate(asText(record.get("date")));
        if (rowEmployeeId == null || recordDate == null) {
            continue;
        }
        String key = rowEmployeeId + "|" + recordDate;
        Map<String, Object> existing = actualByEmployeeDate.get(key);
        if (shouldReplaceMonthlyRecord(existing, record)) {
            actualByEmployeeDate.put(key, record);
        }
    }

    List<Map<String, Object>> mergedRows = new ArrayList<>();
    for (Employee employee : employees) {
        for (LocalDate cursor = range.start(); !cursor.isAfter(range.end()); cursor = cursor.plusDays(1)) {
            Map<String, Object> calendarRow = new LinkedHashMap<>();
            calendarRow.put("id", null);
            calendarRow.put("date", cursor.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
            calendarRow.put("attendanceStatus", null);
            calendarRow.put("dayStatus", null);
            calendarRow.put("timeIn", null);
            calendarRow.put("timeOut", null);
            calendarRow.put("missedTimes", 0);
            calendarRow.put("location", null);
            calendarRow.put("employeeId", employee.getId());
            calendarRow.put("employee", toEmployeeMap(employee));

            Map<String, Object> actual = actualByEmployeeDate.get(employee.getId() + "|" + cursor);
            if (actual == null) {
                mergedRows.add(calendarRow);
                continue;
            }
            Map<String, Object> merged = new LinkedHashMap<>(calendarRow);
            merged.putAll(actual);
            merged.put("date", calendarRow.get("date"));
            merged.put("employeeId", employee.getId());
            merged.put("employee", calendarRow.get("employee"));
            mergedRows.add(merged);
        }
    }

    return attendanceClassificationService.classifyRecordMaps(mergedRows, clientId);
}

private List<Employee> resolveEmployeesForCalendar(Long clientId, Employee selectedEmployee, String branch) {
    if (selectedEmployee != null) {
        if (branch != null && !branch.equalsIgnoreCase(String.valueOf(selectedEmployee.getBranch()).trim())) {
            return List.of();
        }
        return List.of(selectedEmployee);
    }
    if (clientId != null && branch != null) {
        return employeeRepository.findByClientIdAndBranchIgnoreCase(clientId, branch);
    }
    if (clientId != null) {
        return employeeRepository.findByClientId(clientId);
    }
    if (branch != null) {
        return employeeRepository.findByBranchIgnoreCase(branch);
    }
    return employeeRepository.findAll();
}

private Map<String, Object> toEmployeeMap(Employee employeeSource) {
    Map<String, Object> employee = new HashMap<>();
    employee.put("id", employeeSource.getId());
    employee.put("employeeId", employeeSource.getId());
    employee.put("firstName", employeeSource.getFirstName());
    employee.put("lastName", employeeSource.getLastName());
    employee.put("branch", employeeSource.getBranch());
    employee.put("employeeCode", employeeSource.getEmployeeCode());
    employee.put("weekOff", employeeSource.getWeekOff());
    employee.put("shiftStartTime", employeeSource.getShiftStartTime());
    employee.put("shiftEndTime", employeeSource.getShiftEndTime());
    employee.put("leavePolicyType", employeeSource.getLeavePolicyType());
    return employee;
}

private List<String> buildDateCandidates(LocalDate start, LocalDate end) {
    Set<String> dates = new LinkedHashSet<>();
    for (LocalDate cursor = start; !cursor.isAfter(end); cursor = cursor.plusDays(1)) {
        dates.add(cursor.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        dates.add(cursor.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
        dates.add(cursor.format(DateTimeFormatter.ofPattern("dd-MM-yyyy")));
    }
    return new ArrayList<>(dates);
}

private DateRange resolveDateRange(String date, String startDate, String endDate, Integer month, Integer year) {
    LocalDate exactDate = parseFlexibleDate(date);
    if (exactDate != null) {
        return new DateRange(exactDate, exactDate);
    }
    if (month != null && year != null && month >= 1 && month <= 12 && year >= 1900) {
        YearMonth yearMonth = YearMonth.of(year, month);
        return new DateRange(yearMonth.atDay(1), yearMonth.atEndOfMonth());
    }
    LocalDate start = parseFlexibleDate(startDate);
    LocalDate end = parseFlexibleDate(endDate);
    if (start == null && end == null) {
        return null;
    }
    if (start == null) {
        start = end;
    }
    if (end == null) {
        end = start;
    }
    if (end.isBefore(start)) {
        return new DateRange(end, start);
    }
    return new DateRange(start, end);
}

private List<Map<String, Object>> filterByClassifiedStatus(List<Map<String, Object>> records, String status) {
    String normalized = normalizeStatus(status);
    if (normalized == null) {
        return records;
    }
    return records.stream()
            .filter(record -> {
                if ("Late".equals(normalized)) {
                    return "Present".equals(normalizeStatus(asText(record.get("countStatus"))))
                            && asInt(record.get("lateMinutes")) > 0;
                }
                String countStatus = normalizeStatus(asText(record.get("countStatus")));
                String displayStatus = normalizeStatus(asText(record.get("displayStatus")));
                return normalized.equals(countStatus) || normalized.equals(displayStatus);
            })
            .toList();
}

private String normalizeStatus(String status) {
    if (status == null || status.isBlank()) {
        return null;
    }
    String value = status.trim().toLowerCase().replaceAll("[\\s_-]+", "");
    if (value.contains("present")) return "Present";
    if (value.contains("absent")) return "Absent";
    if (value.contains("late")) return "Late";
    if (value.contains("weekoff") || value.contains("weekendoff")) return "Week Off";
    if (value.contains("holiday")) return "Holiday";
    if (value.contains("leave")) return "Leave";
    return status.trim();
}

private String normalizeBranch(String branch) {
    if (branch == null || branch.isBlank()) {
        return null;
    }
    return branch.trim().toLowerCase();
}

private int compareRecordMapsNewestFirst(Map<String, Object> left, Map<String, Object> right) {
    LocalDate leftDate = parseFlexibleDate(asText(left.get("date")));
    LocalDate rightDate = parseFlexibleDate(asText(right.get("date")));
    if (leftDate != null && rightDate != null && !leftDate.equals(rightDate)) {
        return rightDate.compareTo(leftDate);
    }
    if (leftDate == null && rightDate != null) return 1;
    if (leftDate != null) return -1;

    LocalDateTime leftTime = left.get("timeIn") instanceof LocalDateTime time ? time : null;
    LocalDateTime rightTime = right.get("timeIn") instanceof LocalDateTime time ? time : null;
    if (leftTime != null && rightTime != null) {
        return rightTime.compareTo(leftTime);
    }
    if (leftTime == null && rightTime != null) return 1;
    if (leftTime != null) return -1;
    Long leftId = asLong(left.get("id"));
    Long rightId = asLong(right.get("id"));
    if (leftId != null && rightId != null) {
        return rightId.compareTo(leftId);
    }
    return 0;
}

private Long asLong(Object value) {
    if (value instanceof Number number) {
        return number.longValue();
    }
    String text = asText(value);
    if (text == null) {
        return null;
    }
    try {
        return Long.parseLong(text);
    } catch (NumberFormatException ex) {
        return null;
    }
}

private int asInt(Object value) {
    if (value instanceof Number number) {
        return number.intValue();
    }
    String text = asText(value);
    if (text == null) {
        return 0;
    }
    try {
        return Integer.parseInt(text);
    } catch (NumberFormatException ex) {
        return 0;
    }
}

private record DateRange(LocalDate start, LocalDate end) {
}

private boolean isRecordInMonth(AttendanceRecord record, int month, int year) {
    if (record == null) {
        return false;
    }
    LocalDate date = parseFlexibleDate(record.getDate());
    if (date == null) {
        return false;
    }
    return date.getMonthValue() == month && date.getYear() == year;
}

private List<String> buildMonthDateCandidates(YearMonth yearMonth) {
    List<String> dates = new ArrayList<>();
    for (LocalDate cursor = yearMonth.atDay(1); !cursor.isAfter(yearMonth.atEndOfMonth()); cursor = cursor.plusDays(1)) {
        dates.add(cursor.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        dates.add(cursor.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
        dates.add(cursor.format(DateTimeFormatter.ofPattern("dd-MM-yyyy")));
    }
    return dates;
}

private boolean shouldReplaceMonthlyRecord(Map<String, Object> existing, Map<String, Object> candidate) {
    if (existing == null) {
        return true;
    }
    boolean existingHasPunch = existing.get("timeIn") != null || existing.get("timeOut") != null;
    boolean candidateHasPunch = candidate.get("timeIn") != null || candidate.get("timeOut") != null;
    if (candidateHasPunch != existingHasPunch) {
        return candidateHasPunch;
    }
    Long existingId = existing.get("id") instanceof Number number ? number.longValue() : null;
    Long candidateId = candidate.get("id") instanceof Number number ? number.longValue() : null;
    if (existingId == null) {
        return candidateId != null;
    }
    if (candidateId == null) {
        return false;
    }
    return candidateId > existingId;
}

private LocalDate parseFlexibleDate(String raw) {
    if (raw == null || raw.isBlank()) {
        return null;
    }
    String value = raw.trim();
    DateTimeFormatter[] formatters = new DateTimeFormatter[] {
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy")
    };
    for (DateTimeFormatter formatter : formatters) {
        try {
            return LocalDate.parse(value, formatter);
        } catch (DateTimeParseException ignored) {
            // try next format
        }
    }
    return null;
}

private LocalDateTime parseDateTime(Object raw, String recordDate) {
    String value = asText(raw);
    if (value == null || value.isBlank()) {
        return null;
    }
    DateTimeFormatter[] dateTimeFormatters = new DateTimeFormatter[] {
            DateTimeFormatter.ISO_LOCAL_DATE_TIME,
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
    };
    for (DateTimeFormatter formatter : dateTimeFormatters) {
        try {
            return LocalDateTime.parse(value, formatter);
        } catch (DateTimeParseException ignored) {
            // try next format
        }
    }

    LocalDate date = parseFlexibleDate(recordDate);
    if (date == null) {
        date = LocalDate.now();
    }
    DateTimeFormatter[] timeFormatters = new DateTimeFormatter[] {
            DateTimeFormatter.ofPattern("H:mm:ss"),
            DateTimeFormatter.ofPattern("H:mm")
    };
    for (DateTimeFormatter formatter : timeFormatters) {
        try {
            return LocalDateTime.of(date, java.time.LocalTime.parse(value, formatter));
        } catch (DateTimeParseException ignored) {
            // try next format
        }
    }
    return null;
}

private String asText(Object value) {
    if (value == null) {
        return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
}

private Integer asInteger(Object value) {
    String text = asText(value);
    if (text == null) {
        return null;
    }
    try {
        return Integer.parseInt(text);
    } catch (NumberFormatException ex) {
        return null;
    }
}

private Double asDouble(Object value) {
    String text = asText(value);
    if (text == null) {
        return null;
    }
    try {
        return Double.parseDouble(text);
    } catch (NumberFormatException ex) {
        return null;
    }
}

private Long parseLongOrNull(String value) {
    if (value == null || value.isBlank()) {
        return null;
    }
    try {
        return Long.parseLong(value.trim());
    } catch (NumberFormatException ex) {
        return null;
    }
}

private void updateWorkedHours(AttendanceRecord record) {
    if (record == null || record.getTimeIn() == null || record.getTimeOut() == null
            || !record.getTimeOut().isAfter(record.getTimeIn())) {
        if (record != null) {
            record.setWorkedHours(null);
        }
        return;
    }
    long minutes = java.time.Duration.between(record.getTimeIn(), record.getTimeOut()).toMinutes();
    record.setWorkedHours(Math.round((minutes / 60.0) * 100.0) / 100.0);
}
@GetMapping("/by-date-status-all")
public List<AttendanceRecord> getAttendanceByDateAndStatusAll(
        @RequestParam("date") String date,
        @RequestParam("attendanceStatus") String attendanceStatus,
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 200));
    List<AttendanceRecord> records = clientId == null
            ? attendanceRecordRepository.findByDateAndAttendanceStatusOrderByIdDesc(date, attendanceStatus, PageRequest.of(0, safeLimit))
            : attendanceRecordRepository.findByDateAndAttendanceStatusAndEmployee_ClientIdOrderByIdDesc(date, attendanceStatus, clientId, PageRequest.of(0, safeLimit));
    safeSyncRecords(records);
    applyResponseMissedTimes(records);
    return records;
}
// Get all ABSENT employees for a particular date
@GetMapping("/absent-by-date")
public List<AttendanceRecord> getAbsentByDate(
        @RequestParam("date") String date,
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 200));
    List<AttendanceRecord> records = clientId == null
            ? attendanceRecordRepository.findByDateAndAttendanceStatusOrderByIdDesc(date, "Absent", PageRequest.of(0, safeLimit))
            : attendanceRecordRepository.findByDateAndAttendanceStatusAndEmployee_ClientIdOrderByIdDesc(date, "Absent", clientId, PageRequest.of(0, safeLimit));
    safeSyncRecords(records);
    applyResponseMissedTimes(records);
    return records;
}

@GetMapping("/auto-absent/run-today")
public ResponseEntity<?> runAutoAbsentToday() {
    int updated = attendanceSchedulerService.runAutoAbsentForToday();
    return ResponseEntity.ok(Map.of("updatedAbsentCount", updated));
}

@GetMapping("/debug-dates")
public ResponseEntity<?> debugAttendanceDates(@RequestParam("employeeId") String employeeId) {
    Optional<Employee> employee = resolveEmployeeByRef(employeeId);
    if (employee.isEmpty()) {
        return ResponseEntity.ok(List.of());
    }
    List<Map<String, Object>> rows = attendanceRecordRepository.findByEmployeeId(employee.get().getId())
            .stream()
            .map(record -> {
                Map<String, Object> row = new HashMap<>();
                row.put("id", record.getId());
                row.put("dateRaw", record.getDate());
                LocalDate parsed = parseFlexibleDate(record.getDate());
                row.put("dateParsed", parsed != null ? parsed.toString() : null);
                row.put("status", record.getAttendanceStatus());
                return row;
            })
            .sorted(Comparator.comparing(r -> String.valueOf(r.get("dateParsed")), Comparator.nullsLast(String::compareTo)))
            .collect(Collectors.toList());
    return ResponseEntity.ok(rows);
}























































}
