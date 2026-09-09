package com.example.demo.controller;

import com.example.demo.MODELS.AttendanceRecord;
import com.example.demo.MODELS.AttendanceRecordDTO;
import com.example.demo.MODELS.DateUtil;
import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.EmployeeAdditionalWorkingDay;
import com.example.demo.MODELS.LeavePermission;
import com.example.demo.MODELS.Location;
import com.example.demo.MODELS.OvertimeRequest;
import com.example.demo.MODELS.OvertimeRequestStatus;
import com.example.demo.repo.AttendanceRecordRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.repo.LeavePermissionRepository;
import com.example.demo.repo.LocationRepository;
import com.example.demo.repo.OvertimeRequestRepository;
import com.example.demo.service.AttendanceMetricsService;
import com.example.demo.service.AttendanceSchedulerService;
import com.example.demo.service.AttendanceClassificationService;
import com.example.demo.service.AttendanceService;
import com.example.demo.service.AdditionalWorkingDayService;
import com.example.demo.service.EmployeeService;
import com.example.demo.service.PayrollCompatibilityDefaults;
import com.example.demo.service.RequestFilterService;
import com.example.demo.service.ShiftResolverService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/attendance")
@CrossOrigin(origins = "*")
public class AttendanceController {
    private static final Logger LOGGER = LoggerFactory.getLogger(AttendanceController.class);

    @Autowired
private EmployeeRepository employeeRepository;
@Autowired
private EmployeeService employeeService;

@Autowired
private LeavePermissionRepository leavePermissionRepository;

@Autowired
private AttendanceMetricsService attendanceMetricsService;
@Autowired
private AttendanceClassificationService attendanceClassificationService;
@Autowired
private AdditionalWorkingDayService additionalWorkingDayService;
@Autowired
private RequestFilterService requestFilterService;
@Autowired
private AttendanceSchedulerService attendanceSchedulerService;
@Autowired
private ShiftResolverService shiftResolverService;
@Autowired
private LocationRepository locationRepository;

   @Autowired
    private AttendanceService attendanceService;



    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;
    @Autowired
    private com.example.demo.service.SchemaMaintenanceService schemaMaintenanceService;
    @Autowired
    private OvertimeRequestRepository overtimeRequestRepository;
        private static final DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FORMATTER_HH_MM = DateTimeFormatter.ofPattern("H:mm");
    private static final DateTimeFormatter TIME_FORMATTER_HH_MM_SS = DateTimeFormatter.ofPattern("H:mm:ss");
@PutMapping("/start-day")
public ResponseEntity<?> startDay(@RequestParam Long employeeId,
                                  @RequestParam String location,
                                  @RequestParam(value = "clientId", required = false) Long clientId,
                                  @RequestParam(value = "latitude", required = false) Double latitude,
                                  @RequestParam(value = "longitude", required = false) Double longitude) {
    schemaMaintenanceService.ensureEmployeeSchema();
    String todayDate = LocalDate.now().format(dateFormatter);
    String yesterdayDate = LocalDate.now().minusDays(1).format(dateFormatter);

    // 1. Check if employee exists
    Optional<Employee> employeeOptional = employeeRepository.findById(employeeId);
    if (employeeOptional.isEmpty()) {
        return ResponseEntity.badRequest().body("Employee not found.");
    }
    Employee employee = employeeOptional.get();

    if (latitude != null && longitude != null) {
        Long effectiveClientId = clientId != null ? clientId : employee.getClientId();
        if (!isInsideAnyBranchLocation(latitude, longitude, effectiveClientId)) {
            Map<String, Object> inactive = new HashMap<>();
            inactive.put("status", "Inactive");
            inactive.put("message", "Outside assigned branch location. Submit location request.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(inactive);
        }
    }

    // 2. Check yesterday's attendance for missing time-out
    List<AttendanceRecord> yesterdayRecords = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, yesterdayDate);
    if (!yesterdayRecords.isEmpty()) {
        AttendanceRecord yesterdayRecord = yesterdayRecords.get(0);
        if (yesterdayRecord.getAttendanceStatus().equalsIgnoreCase("Present") &&
            yesterdayRecord.getTimeOut() == null) {
            // If TimoutReason is not set, block and return the record ID
            if (yesterdayRecord.getTimoutReason() == null || yesterdayRecord.getTimoutReason().isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("error", "You didn’t mark time-out yesterday. Please submit a timeout reason.");
                response.put("missedTimeoutRecordId", yesterdayRecord.getId());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
            }
        }
    }

    // 3. Check if attendance already marked today
    List<AttendanceRecord> todayRecords = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, todayDate);
    if (!todayRecords.isEmpty()) {
        String status = todayRecords.get(0).getAttendanceStatus();
        return ResponseEntity.badRequest()
                .body("Attendance already marked as '" + status + "' for today.");
    }

    // 4. If all checks passed, create attendance record
    AttendanceRecord record = new AttendanceRecord();
    record.setEmployee(employee);
    record.setAttendanceStatus("Present");
    record.setDate(todayDate);
    record.setLocation(location); // Store location
    applyShiftSnapshot(record, employee, LocalDate.now(), clientId);

    attendanceRecordRepository.save(record);

    return ResponseEntity.ok("Day started. Please mark time-in.");
}

private boolean isInsideAnyBranchLocation(double latitude, double longitude, Long clientId) {
    List<Location> locations = clientId == null ? locationRepository.findAll() : locationRepository.findByClientId(clientId);
    for (Location location : locations) {
        if (location.getLatitude() == null || location.getLongitude() == null || location.getRadius() == null) {
            continue;
        }
        double distance = distanceMeters(latitude, longitude, location.getLatitude(), location.getLongitude());
        if (distance <= location.getRadius()) {
            return true;
        }
    }
    return false;
}

private double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    double rad = Math.PI / 180.0;
    double dLat = (lat2 - lat1) * rad;
    double dLon = (lon2 - lon1) * rad;
    double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371000.0 * c;
}
    
@PostMapping("/submit-timeout-reason")
public ResponseEntity<?> submitTimeoutReason(@RequestParam Long recordId, @RequestParam String reason) {
    schemaMaintenanceService.ensureEmployeeSchema();
    Optional<AttendanceRecord> optionalRecord = attendanceRecordRepository.findById(recordId);
    if (optionalRecord.isPresent()) {
        AttendanceRecord record = optionalRecord.get();
        record.setTimoutReason(reason);
        attendanceRecordRepository.save(record);
        return ResponseEntity.ok("Timeout reason submitted successfully.");
    } else {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Attendance record not found.");
    }
}
@GetMapping("/missed-timeout")
public List<Map<String, Object>> getMissedTimeoutEmployees(
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "branch", required = false) String branch,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    try {
        schemaMaintenanceService.ensureEmployeeSchema();
    } catch (Exception ex) {
        ex.printStackTrace();
    }
    Pageable page = PageRequest.of(0, clampListLimit(limit));
    List<Object[]> records = attendanceRecordRepository.findMissedTimeoutRows(
            "Present",
            clientId,
            requestFilterService.normalizeBranch(branch),
            page);
    List<Map<String, Object>> result = new ArrayList<>();
    for (Object[] record : records) {
        Map<String, Object> map = new HashMap<>();
        map.put("attendanceId", record[0]);
        map.put("firstName", record[1]);
        map.put("lastName", record[2]);
        map.put("mobile", record[3]);
        map.put("branch", record[4]);
        map.put("position", record[5]);
        map.put("date", record[6]);
        map.put("timeoutReason", null);
        result.add(map);
    }
    return result;
}

@GetMapping("/missed-timeout/count")
public ResponseEntity<Long> getMissedTimeoutCount(
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "branch", required = false) String branch) {
    try {
        schemaMaintenanceService.ensureEmployeeSchema();
        long count = attendanceRecordRepository.countMissedTimeoutRows(
                "Present",
                clientId,
                requestFilterService.normalizeBranch(branch));
        return ResponseEntity.ok(count);
    } catch (Exception ex) {
        ex.printStackTrace();
        return ResponseEntity.ok(0L);
    }
}

@GetMapping("/completed-missed-timeout")
public List<Map<String, Object>> getCompletedMissedTimeoutEmployees(
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "branch", required = false) String branch,
        @RequestParam(value = "limit", defaultValue = "200") int limit) {
    int responseLimit = clampListLimit(limit);
    Pageable page = PageRequest.of(0, responseLimit);
    List<Object[]> rows = attendanceRecordRepository.findCompletedMissedTimeoutRows(
            "Present",
            clientId,
            requestFilterService.normalizeBranch(branch),
            page);
    List<Map<String, Object>> result = new ArrayList<>();

    for (Object[] record : rows) {
        Map<String, Object> map = new HashMap<>();
        map.put("attendanceId", record[0]);
        map.put("firstName", record[1]);
        map.put("lastName", record[2]);
        map.put("mobile", record[3]);
        map.put("branch", record[4]);
        map.put("position", record[5]);
        map.put("date", record[6]);
        map.put("timeoutReason", record[7]);
        map.put("timeOut", record[8]);
        map.put("status", "COMPLETED");
        result.add(map);
    }

    return result;
}

private int clampListLimit(int limit) {
    if (limit <= 0) {
        return 200;
    }
    return Math.min(limit, 200);
}

@DeleteMapping("/completed-missed-timeout/{attendanceId}")
public ResponseEntity<?> deleteCompletedMissedTimeoutRecord(
        @PathVariable Long attendanceId,
        @RequestParam(value = "clientId", required = false) Long clientId) {
    Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(attendanceId);
    if (optional.isEmpty()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Attendance record not found.");
    }

    AttendanceRecord record = optional.get();
    Employee employee = record.getEmployee();
    if (employee == null) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid attendance record.");
    }
    if (clientId != null && !clientId.equals(employee.getClientId())) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied for this record.");
    }
    if (record.getTimeOut() == null) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Only completed clockout requests can be deleted.");
    }

    String timeoutReason = record.getTimoutReason();
    if (timeoutReason == null || timeoutReason.trim().isEmpty()) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body("Only completed missed-time requests can be deleted.");
    }

    attendanceRecordRepository.delete(record);
    return ResponseEntity.ok("Completed clockout request deleted successfully.");
}

@DeleteMapping("/completed-missed-timeout")
public ResponseEntity<?> deleteAllCompletedMissedTimeoutRecords(
        @RequestParam(value = "clientId", required = false) Long clientId) {
    List<AttendanceRecord> records = attendanceRecordRepository.findByAttendanceStatus("Present");
    List<AttendanceRecord> toDelete = new ArrayList<>();

    for (AttendanceRecord record : records) {
        if (record == null || record.getEmployee() == null) {
            continue;
        }
        if (clientId != null && !clientId.equals(record.getEmployee().getClientId())) {
            continue;
        }
        if (record.getTimeOut() == null) {
            continue;
        }
        String timeoutReason = record.getTimoutReason();
        if (timeoutReason == null || timeoutReason.trim().isEmpty()) {
            continue;
        }
        toDelete.add(record);
    }

    if (toDelete.isEmpty()) {
        return ResponseEntity.ok(Map.of("deletedCount", 0, "message", "No completed clockout requests found."));
    }

    attendanceRecordRepository.deleteAll(toDelete);
    return ResponseEntity.ok(Map.of("deletedCount", toDelete.size(), "message", "Completed clockout requests deleted."));
}
@PutMapping("/complete-missed-timeout")
public ResponseEntity<?> completeMissedTimeout(
        @RequestParam Long attendanceId,
        @RequestParam String timeOut,
        @RequestParam(required = false) Boolean overtimeApproved // Format: "yyyy-MM-dd'T'HH:mm:ss"
) {
    schemaMaintenanceService.ensureEmployeeSchema();
    Optional<AttendanceRecord> optional = attendanceRecordRepository.findById(attendanceId);
    if (optional.isEmpty()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Attendance record not found.");
    }
    AttendanceRecord record = optional.get();
    record.setDayStatus("Completed");
    record.setTimeOut(LocalDateTime.parse(timeOut));
    updateDerivedAttendanceHours(record);
    if (overtimeApproved != null) {
        record.setOvertimeApproved(overtimeApproved);
    }
    // Automatically calculate and update missed times
    employeeService.updateMissedTimes(record);
    attendanceRecordRepository.save(record);
    return ResponseEntity.ok("Timeout, missed times, and day status updated.");
}
@CrossOrigin(origins = "*")
@PostMapping("/mark-time-in")
@Transactional
public ResponseEntity<String> markTimeIn(
        @RequestParam Long recordId,
        @RequestParam MultipartFile imageIn,
        @RequestParam(required = false) Long clientId) {
    schemaMaintenanceService.ensureEmployeeSchema();
    Optional<AttendanceRecord> optionalRecord = attendanceRecordRepository.findById(recordId);
    if (optionalRecord.isEmpty()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Attendance record not found");
    }

    AttendanceRecord record = optionalRecord.get();
    Employee employee = record.getEmployee();
    Long employeeId = employee == null ? null : employee.getId();
    Long recordClientId = employee == null ? null : employee.getClientId();

    if (employee == null) {
        LOGGER.warn("Time-in rejected because attendance record has no employee. recordId={}", recordId);
        return ResponseEntity.badRequest().body("Attendance record is not linked to an employee.");
    }
    if (clientId != null && recordClientId != null && !clientId.equals(recordClientId)) {
        LOGGER.warn("Time-in rejected because clientId does not match record. recordId={} employeeId={} requestClientId={} recordClientId={}",
                recordId, employeeId, clientId, recordClientId);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Attendance record does not belong to this client.");
    }
    if (record.getTimeIn() != null) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body("Time-in already recorded.");
    }
    if (imageIn == null || imageIn.isEmpty()) {
        return ResponseEntity.badRequest().body("Time-in photo is required.");
    }

    try {
        if (record.getDate() == null || record.getDate().isBlank()) {
            record.setDate(LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        }
        applyShiftSnapshotIfMissing(record);
        record.setTimeIn(LocalDateTime.now());
        record.setImageIn(imageIn.getBytes());
        attendanceRecordRepository.save(record);
        return ResponseEntity.ok("Time-in recorded successfully.");
    } catch (IOException e) {
        LOGGER.error("Time-in image read failed. recordId={} employeeId={} clientId={}", recordId, employeeId, recordClientId, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Image processing failed");
    } catch (DataIntegrityViolationException e) {
        LOGGER.error("Time-in save failed because attendance record data is invalid. recordId={} employeeId={} clientId={}",
                recordId, employeeId, recordClientId, e);
        return ResponseEntity.status(HttpStatus.CONFLICT).body("Attendance record could not be saved. Please refresh and try again.");
    } catch (DataAccessException e) {
        LOGGER.error("Time-in database save failed. recordId={} employeeId={} clientId={}",
                recordId, employeeId, recordClientId, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Attendance save failed. Please try again.");
    } catch (RuntimeException e) {
        LOGGER.error("Unexpected time-in failure. recordId={} employeeId={} clientId={}",
                recordId, employeeId, recordClientId, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Time-in failed. Please try again.");
    }
}

    @GetMapping("/all")
    public List<AttendanceRecord> getAllAttendanceRecords() {
        schemaMaintenanceService.ensureEmployeeSchema();
        return attendanceRecordRepository.findAll();
    }


 @GetMapping("/monthly/{employeeId}")
    public List<AttendanceRecord> getMonthlyAttendance(@PathVariable Long employeeId) {
        schemaMaintenanceService.ensureEmployeeSchema();
        return attendanceRecordRepository.findByEmployeeId(employeeId);
    }

    // Get one record by date
   @GetMapping("/{employeeId}/{isoDate}")
    public ResponseEntity<?> getByDate(
            @PathVariable Long employeeId,
            @PathVariable String isoDate) {
        schemaMaintenanceService.ensureEmployeeSchema();

        String dbDate = DateUtil.isoToDb(isoDate);          // 14/07/2025
        return attendanceRecordRepository.findByEmployee_IdAndDate(employeeId, dbDate)
                .map(AttendanceRecordDTO::fromEntity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /* ---------- 2. Monthly list endpoint --------------------------------- */
    // GET /api/attendance/monthly/9/2025/07
    @GetMapping("/monthly/{employeeId}/{year}/{month}")
    public List<AttendanceRecordDTO> getMonth(
            @PathVariable Long employeeId,
            @PathVariable int year,
            @PathVariable int month) {
        schemaMaintenanceService.ensureEmployeeSchema();
        reconcileApprovedSwapWeekoffs(employeeId, year, month);

        String start = DateUtil.dbStartOfMonth(year, month); // 01/07/2025
        String end   = DateUtil.dbEndOfMonth(year, month);   // 31/07/2025

        return attendanceRecordRepository.findMonthlySlice(employeeId, start, end)
                   .stream()
                   .map(AttendanceRecordDTO::fromEntity)
                   .toList();
    }
    // Endpoint to mark time-out with image
    @PostMapping("/mark-time-out")  // worked
    public ResponseEntity<String> markTimeOut(
            @RequestParam Long recordId,
            @RequestParam MultipartFile imageOut,
            @RequestParam(required = false) Boolean overtimeApproved,
            @RequestParam(required = false) Boolean overtimeRequested,
            @RequestParam(required = false) String overtimeReason) {
        schemaMaintenanceService.ensureEmployeeSchema();
        Optional<AttendanceRecord> optionalRecord = attendanceRecordRepository.findById(recordId);
        if (optionalRecord.isPresent()) {
            AttendanceRecord record = optionalRecord.get();
            try {
                if (Boolean.TRUE.equals(overtimeRequested)
                        && (overtimeReason == null || overtimeReason.trim().isEmpty())) {
                    return ResponseEntity.badRequest().body("Overtime reason is required.");
                }
                LocalDateTime now = LocalDateTime.now();
                record.setTimeOut(now);
                applyShiftSnapshotIfMissing(record);
                updateDerivedAttendanceHours(record);
                if (overtimeApproved != null) {
                    record.setOvertimeApproved(overtimeApproved);
                }
                if (overtimeRequested != null) {
                    record.setOvertimeRequested(overtimeRequested);
                }
                if (imageOut != null && !imageOut.isEmpty()) {
                    record.setImageOut(imageOut.getBytes());
                }
                attendanceRecordRepository.save(record);

                if (Boolean.TRUE.equals(overtimeRequested)) {
                    Employee employee = record.getEmployee();
                    if (employee != null) {
                        LocalTime shiftEnd = resolveShiftEnd(record);
                        LocalTime logoutTime = now.toLocalTime();
                        long overtimeMinutes = 0;
                        if (logoutTime.isAfter(shiftEnd)) {
                            overtimeMinutes = Duration.between(shiftEnd, logoutTime).toMinutes();
                        }
                        double overtimeHours = Math.max(overtimeMinutes, 0) / 60.0;
                        if (overtimeHours > 0) {
                            OvertimeRequest request = overtimeRequestRepository
                                    .findFirstByEmployeeIdAndDateOrderByIdDesc(employee.getId(), record.getDate())
                                    .orElseGet(OvertimeRequest::new);
                            request.setEmployee(employee);
                            request.setDate(record.getDate());
                            request.setOvertimeHours(overtimeHours);
                            request.setReason(overtimeReason == null ? null : overtimeReason.trim());
                            request.setStatus(OvertimeRequestStatus.PENDING);
                            overtimeRequestRepository.save(request);
                            record.setOvertimeApproved(false);
                            attendanceRecordRepository.save(record);
                        }
                    }
                }

                return ResponseEntity.ok("Time-out recorded successfully.");
            } catch (IOException e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to process image.");
            }
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Attendance record not found.");
        }
    }

    // Endpoint to update day status
    @PostMapping("/update-day-status")
    public ResponseEntity<String> updateDayStatus(
            @RequestParam Long recordId,
            @RequestParam String dayStatus) {
    
        Optional<AttendanceRecord> optionalRecord = attendanceRecordRepository.findById(recordId);
    
        if (optionalRecord.isPresent()) {
            AttendanceRecord record = optionalRecord.get();
    
            // 1. Set day status
            record.setDayStatus(dayStatus);
    
            // 2. Set timeOut to current time
            record.setTimeOut(LocalDateTime.now());
    
            // 3. Save the updated record
            attendanceRecordRepository.save(record);
    
            // 4. Update missed time after saving timeOut
            employeeService.updateMissedTimes(record);
    
            return ResponseEntity.ok("Day status, timeOut, and missed time updated successfully.");
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Attendance record not found.");
        }
    }
     // ✅ 1. Get attendance between startDate and endDate
     @GetMapping("/by-date-range")
     public ResponseEntity<List<AttendanceRecord>> getAttendanceByDateRange(
             @RequestParam Long employeeId,
             @RequestParam String startDate,
             @RequestParam String endDate) {
 
         List<AttendanceRecord> records = attendanceRecordRepository
                 .findByEmployeeIdAndDateBetween(employeeId, startDate, endDate);
 
         return ResponseEntity.ok(records);
     }
 
     // ✅ 2. Get attendance for a specific month (format: yyyy-MM)
     @GetMapping("/by-month")
     public ResponseEntity<List<AttendanceRecord>> getAttendanceByMonth(
             @RequestParam Long employeeId,
             @RequestParam String month) {
         // Extract start and end dates from the month
         LocalDate start = LocalDate.parse(month + "-01");
         LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
 
         List<AttendanceRecord> records = attendanceRecordRepository
                 .findByEmployeeIdAndDateBetween(
                         employeeId,
                         start.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
                         end.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))
                 );
 
         return ResponseEntity.ok(records);
     }

    // Endpoint to check if attendance record exists by employeeId and recordId
    @GetMapping("/check-record")
    public ResponseEntity<Object> checkRecord(
            @RequestParam Long employeeId,
            @RequestParam Long recordId) {
    
        Optional<AttendanceRecord> optionalRecord = attendanceRecordRepository.findById(recordId);
    
        if (optionalRecord.isPresent()) {
            AttendanceRecord record = optionalRecord.get();
    
            if (record.getEmployee() != null && record.getEmployee().getId().equals(employeeId)) {
                return ResponseEntity.ok(record); // Return the full record details
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Employee ID does not match the record.");
            }
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Attendance record not found.");
        }
    }
    

    @GetMapping({"/{recordId}/time-in", "/api/attendance/{recordId}/time-in"})
    public ResponseEntity<byte[]> getTimeInImage(@PathVariable Long recordId) {
        Optional<AttendanceRecord> record = attendanceRecordRepository.findById(recordId);
        if (record.isPresent() && record.get().getImageIn() != null) {
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG) // Adjust based on your image format
                    .body(record.get().getImageIn());
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Image not found.".getBytes());
        }
    }
@GetMapping("/incomplete/yesterday/count")
public ResponseEntity<Long> countIncompleteDayStatusYesterday() {
    LocalDate yesterday = LocalDate.now().minusDays(1);
    String formattedDate = yesterday.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));

    Long count = attendanceRecordRepository.countByDateAndDayStatusNot(formattedDate, "Complete");
    return ResponseEntity.ok(count);
}

    // Endpoint to fetch timeIn, imageIn, id, and employeeId by recordId
    @GetMapping("/TimeInDetails/{id}")
    public ResponseEntity<AttendanceRecord> getAttendanceById(@PathVariable Long id) {
        AttendanceRecord record = attendanceRecordRepository.findById(id).orElse(null);
    
        if (record == null) {
            return ResponseEntity.notFound().build();
        }
    
        // Create a new AttendanceRecord to filter fields
        AttendanceRecord filteredRecord = new AttendanceRecord();
        filteredRecord.setId(record.getId());
        filteredRecord.setTimeIn(record.getTimeIn());
        filteredRecord.setImageIn(record.getImageIn());
    
        // Set only employee ID via a minimal Employee object
        if (record.getEmployee() != null) {
            Employee minimalEmployee = new Employee();
            minimalEmployee.setId(record.getEmployee().getId());
            filteredRecord.setEmployee(minimalEmployee);
        }
    
        return ResponseEntity.ok(filteredRecord);
    }
    

    @GetMapping("/TimeOutDetails/{id}")
    public ResponseEntity<AttendanceRecord> getAttendanceTimeOutById(@PathVariable Long id) {
        AttendanceRecord record = attendanceRecordRepository.findById(id).orElse(null);
    
        if (record == null) {
            return ResponseEntity.notFound().build();
        }
    
        // Create a new AttendanceRecord to return only necessary fields
        AttendanceRecord filteredRecord = new AttendanceRecord();
        filteredRecord.setId(record.getId());
        filteredRecord.setTimeOut(record.getTimeOut());
        filteredRecord.setImageOut(record.getImageOut());
    
        if (record.getEmployee() != null) {
            Employee minimalEmployee = new Employee();
            minimalEmployee.setId(record.getEmployee().getId());
            filteredRecord.setEmployee(minimalEmployee);
        }
    
        return ResponseEntity.ok(filteredRecord);
    }
    
 // Endpoint to get attendance details by employeeId and today's date
 @GetMapping("/get-today-attendance")
 public ResponseEntity<Object> getTodayAttendance(@RequestParam Long employeeId) {
     // Get today's date in dd/MM/yyyy format
     String todayDate = LocalDate.now().format(dateFormatter);

     // Fetch records for the given employeeId and today's date
     List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, todayDate);

     if (records.isEmpty()) {
         return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No attendance records found for today.");
     }

     return ResponseEntity.ok(records);
 }
 @GetMapping("/get-yesterday-attendance")
 public ResponseEntity<Object> getYesterdayAttendance(@RequestParam Long employeeId) {
     // Get yesterday's date in dd/MM/yyyy format
     String yesterdayDate = LocalDate.now().minusDays(1).format(dateFormatter);

     // Fetch records for the given employeeId and yesterday's date
     List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, yesterdayDate);

     if (records.isEmpty()) {
         return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No attendance records found for yesterday.");
     }

     return ResponseEntity.ok(records);
 }
 @GetMapping("/check-attendance-present-status")
 public ResponseEntity<String> checkAttendanceStatus(@RequestParam Long employeeId) {
     // Get today's date in dd/MM/yyyy format
     String todayDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
     
     // Fetch the attendance record for today
     List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, todayDate);
     
     if (!records.isEmpty()) { // Check if the list is not empty
         AttendanceRecord record = records.get(0); // Get the first record
         
         // Check if attendanceStatus is "Present"
         if ("Present".equals(record.getAttendanceStatus())) {
             // Check for missing details step by step
             if (record.getTimeIn() == null || record.getImageIn() == null) {
                 return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).body("Time-in and image-in are missing. Please enter them.");
             } else if (record.getTimeOut() == null || record.getImageOut() == null) {
                 return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).body("Time-out and image-out are missing. Please enter them.");
             } else if (record.getDayStatus() == null) {
                 return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).body("Day status is missing. Please enter it.");
             } else {
                 return ResponseEntity.ok("All details are present.");
             }
         } else {
             return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Attendance status is not 'Present'.");
         }
     } else {
         return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No attendance record found for today.");
     }
 }
@PostMapping("/auto-mark-absent")
public ResponseEntity<?> autoMarkAbsentForMissedAttendance() {
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    String todayDate = LocalDate.now().format(formatter);

    List<Employee> allEmployees = employeeRepository.findAll();
    int absentCount = 0;

    for (Employee employee : allEmployees) {
        List<AttendanceRecord> attendanceRecords =
            attendanceRecordRepository.findByEmployeeIdAndDate(employee.getId(), todayDate);

        boolean isAlreadyMarkedToday = !attendanceRecords.isEmpty() && (
            "Present".equalsIgnoreCase(attendanceRecords.get(0).getAttendanceStatus()) ||
            "Absent".equalsIgnoreCase(attendanceRecords.get(0).getAttendanceStatus())
        );

        if (isAlreadyMarkedToday) continue; // Skip if already Present or Absent

        List<LeavePermission> leaves = leavePermissionRepository.findByEmployeeId(employee.getId());
        boolean hasLeaveToday = leaves.stream().anyMatch(leave -> {
            try {
                LocalDate start = LocalDate.parse(leave.getStartDate(), formatter);
                LocalDate end = LocalDate.parse(leave.getEndDate(), formatter);
                LocalDate today = LocalDate.now();
                return !today.isBefore(start) && !today.isAfter(end);
            } catch (Exception e) {
                return false;
            }
        });

        if (!hasLeaveToday) {
            AttendanceRecord absentRecord = new AttendanceRecord();
            absentRecord.setEmployee(employee);
            absentRecord.setAttendanceStatus("Absent");
            absentRecord.setDate(todayDate);
            attendanceRecordRepository.save(absentRecord);
            absentCount++;
        }
    }

    return ResponseEntity.ok(absentCount + " employees marked as absent for today.");
}




 @PostMapping("/mark-absent")
 public ResponseEntity<String> markAbsent(@RequestParam Long employeeId) {
     String todayDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")); // or match `dateFormatter`
 
     List<AttendanceRecord> existingRecords = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, todayDate);
 
     if (!existingRecords.isEmpty()) {
         String status = existingRecords.get(0).getAttendanceStatus();
         return ResponseEntity.badRequest()
                 .body("Attendance already marked as '" + status + "' for today.");
     }
 
     Optional<Employee> employeeOptional = employeeRepository.findById(employeeId);
     if (employeeOptional.isEmpty()) {
         return ResponseEntity.badRequest().body("Employee not found.");
     }
 
     AttendanceRecord attendanceRecord = new AttendanceRecord();
     attendanceRecord.setEmployee(employeeOptional.get());
     attendanceRecord.setAttendanceStatus("Absent");
     attendanceRecord.setDate(todayDate);
 
     attendanceRecordRepository.save(attendanceRecord);
 
     return ResponseEntity.ok("Attendance marked as absent for employee ID: " + employeeId);
 }






//admin

@GetMapping("/attendance-status-today")
public ResponseEntity<Map<String, Object>> getAttendanceStatusForToday() {
    // Get today's date in the desired format (same format used for attendance records)
    String todayDate = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));  // Update this format based on your DB date format

    // Fetch all employees
    List<Employee> allEmployees = employeeRepository.findAll();

    // Prepare the categories
    List<Employee> presentEmployees = new ArrayList<>();
    List<Employee> absentEmployees = new ArrayList<>();
    List<Employee> notPostedEmployees = new ArrayList<>();

    // Iterate through all employees and check attendance records for today
    for (Employee employee : allEmployees) {
        List<AttendanceRecord> existingRecords = attendanceRecordRepository.findByEmployeeIdAndDate(employee.getId(), todayDate);

        if (existingRecords.isEmpty()) {
            // If no record found for the employee on today's date, mark as "Not Posted"
            notPostedEmployees.add(employee);
        } else {
            // If attendance record exists, check the status
            String status = existingRecords.get(0).getAttendanceStatus();
            if ("Present".equalsIgnoreCase(status)) {
                presentEmployees.add(employee);
            } else if ("Absent".equalsIgnoreCase(status)) {
                absentEmployees.add(employee);
            }
        }
    }

    // Prepare the response object
    Map<String, Object> response = new HashMap<>();
    response.put("presentCount", presentEmployees.size());
    response.put("absentCount", absentEmployees.size());
    response.put("notPostedCount", notPostedEmployees.size());
    
    response.put("presentEmployees", presentEmployees);
    response.put("absentEmployees", absentEmployees);
    response.put("notPostedEmployees", notPostedEmployees);

    return ResponseEntity.ok(response);
}










// newwwwwwww


@GetMapping("/getByDateAndEmployee")
public ResponseEntity<Map<String, Object>> getAttendanceByDateAndEmployeeId(
        @RequestParam String date,
        @RequestParam Long employeeId) {

    return attendanceRecordRepository.findByDateAndEmployeeId(date, employeeId)
            .map(attendance -> {
                Map<String, Object> response = new HashMap<>();
                response.put("employeeId", employeeId);
                response.put("date", attendance.getDate());
                response.put("dayStatus", attendance.getDayStatus());
                response.put("attendanceStatus", attendance.getAttendanceStatus());
                response.put("timeIn", attendance.getTimeIn());
                response.put("timeOut", attendance.getTimeOut());
                return ResponseEntity.ok(response);
            })
            .orElseGet(() -> {
                Map<String, Object> response = new HashMap<>();
                response.put("found", false);
                response.put("employeeId", employeeId);
                response.put("date", date);
                response.put("message", "No record found");
                return ResponseEntity.ok(response);
            });
}




    @GetMapping("/latest/{employeeId}")
    public ResponseEntity<?> getLatestAttendance(@PathVariable Long employeeId) {
        Optional<AttendanceRecord> latestRecord = attendanceService.getLatestAttendanceRecord(employeeId);
        if (latestRecord.isPresent()) {
            return ResponseEntity.ok(latestRecord.get());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("found", false);
        response.put("employeeId", employeeId);
        response.put("message", "No attendance record found.");
        return ResponseEntity.ok(response);
    }
@GetMapping("/latest-today-or-yesterday/{employeeId}")
public ResponseEntity<?> getTodayOrYesterdayAttendance(@PathVariable Long employeeId) {
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    String today = LocalDate.now().format(formatter);
    String yesterday = LocalDate.now().minusDays(1).format(formatter);

    // Try to get today's record
    List<AttendanceRecord> todayRecords = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, today);
    if (!todayRecords.isEmpty()) {
        return ResponseEntity.ok(todayRecords.get(0));
    }

    // If not found, try to get yesterday's record
    List<AttendanceRecord> yesterdayRecords = attendanceRecordRepository.findByEmployeeIdAndDate(employeeId, yesterday);
    if (!yesterdayRecords.isEmpty()) {
        return ResponseEntity.ok(yesterdayRecords.get(0));
    }

    Map<String, Object> response = new HashMap<>();
    response.put("found", false);
    response.put("employeeId", employeeId);
    response.put("message", "No attendance record found for today or yesterday.");
    return ResponseEntity.ok(response);
}

    @GetMapping("/employee/{employeeId}")
    public List<AttendanceRecord> getAttendanceByMonthAndYear(
            @PathVariable Long employeeId,
            @RequestParam int month,
            @RequestParam int year) {

        List<AttendanceRecord> records = attendanceRecordRepository.findByEmployeeId(employeeId);
        
        // Filter based on month and year from string `date`
        return records.stream()
                .filter(r -> {
                    try {
                        LocalDate recordDate = LocalDate.parse(r.getDate(), DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                        return recordDate.getMonthValue() == month && recordDate.getYear() == year;
                    } catch (Exception e) {
                        return false;
                    }
                })
                .collect(Collectors.toList());
    }
@GetMapping("/today-timein")
public ResponseEntity<List<Map<String, Object>>> getTodayTimeInDetails(
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "branch", required = false) String branch) {
    Map<Long, Map<String, Object>> uniqueRecords = new LinkedHashMap<>();
    String normalizedBranch = requestFilterService.normalizeBranch(branch);
    for (String dateValue : dateCandidates(LocalDate.now())) {
        attendanceRecordRepository.findTodayPresentTimeInRowsByDateAndClientAndBranch(
                        dateValue,
                        clientId,
                        normalizedBranch,
                        PageRequest.of(0, 200))
                .forEach(row -> {
                    Long attendanceId = asLong(row[0]);
                    if (attendanceId != null) {
                        uniqueRecords.putIfAbsent(attendanceId, toTodayTimeInMap(row));
                    }
                });
    }
    return ResponseEntity.ok(new ArrayList<>(uniqueRecords.values()));
}

private Map<String, Object> toTodayTimeInMap(Object[] row) {
    String firstName = row[2] == null ? "" : String.valueOf(row[2]).trim();
    String lastName = row[3] == null ? "" : String.valueOf(row[3]).trim();
    String fullName = (firstName + " " + lastName).trim();
    Map<String, Object> map = new HashMap<>();
    map.put("employeeId", row[1]);
    map.put("firstName", firstName);
    map.put("lastName", lastName);
    map.put("name", fullName.isEmpty() ? firstName : fullName);
    map.put("branch", row[4]);
    map.put("mobile", row[5]);
    map.put("profileImage", row[6]);
    map.put("timeIn", row[7]);
    map.put("timeOut", row[8]);
    map.put("locationIn", row[9]);
    map.put("locationOut", row[9]);
    map.put("hasCheckedOut", row[8] != null);
    map.put("status", row[10]);
    return map;
}

private Long asLong(Object value) {
    if (value instanceof Number number) {
        return number.longValue();
    }
    if (value == null) {
        return null;
    }
    try {
        return Long.parseLong(String.valueOf(value));
    } catch (NumberFormatException ex) {
        return null;
    }
}

@GetMapping("/today-absent")
public Map<String, Object> getTodayAbsent(
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "branch", required = false) String branch) {
    String normalizedBranch = requestFilterService.normalizeBranch(branch);
    DashboardSummaryResult result = buildDashboardSummary(LocalDate.now(), clientId, normalizedBranch);
    Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
    grouped.put("absent", new ArrayList<>());
    grouped.put("weekOff", new ArrayList<>());
    grouped.put("holiday", new ArrayList<>());

    for (Map<String, Object> record : result.classifiedRecords()) {
        LocalDate recordDate = parseDashboardRecordDate(String.valueOf(record.getOrDefault("date", "")));
        if (!result.summaryDate().equals(recordDate)) {
            continue;
        }
        if ("Present".equalsIgnoreCase(String.valueOf(record.getOrDefault("countStatus", "")))) {
            continue;
        }

        if (Boolean.TRUE.equals(record.get("holiday"))) {
            grouped.get("holiday").add(toAbsentPopupEmployee(record, "Holiday"));
        } else if (Boolean.TRUE.equals(record.get("weekOff"))) {
            grouped.get("weekOff").add(toAbsentPopupEmployee(record, "Week Off"));
        } else if ("Absent".equalsIgnoreCase(String.valueOf(record.getOrDefault("countStatus", "")))) {
            grouped.get("absent").add(toAbsentPopupEmployee(record, "Absent"));
        }
    }

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("date", result.summaryDate().format(dateFormatter));
    response.put("totalEmployees", result.totalEmployees());
    response.put("presentCount", result.today().present());
    response.put("nonPresentCount", Math.max(0L, result.totalEmployees() - result.today().present()));
    response.put("absent", grouped.get("absent"));
    response.put("weekOff", grouped.get("weekOff"));
    response.put("holiday", grouped.get("holiday"));
    response.put("counts", Map.of(
            "absent", grouped.get("absent").size(),
            "weekOff", grouped.get("weekOff").size(),
            "holiday", grouped.get("holiday").size()));
    return response;
}

@GetMapping("/today-absent/count")
public ResponseEntity<Long> getTodayAbsentCount(
        @RequestParam(value = "clientId", required = false) Long clientId) {
    return ResponseEntity.ok(attendanceService.countTodayAbsentRecords(clientId));
}
@GetMapping("/today-time-in-late")
public ResponseEntity<List<Map<String, Object>>> getTodayTimeInLateDetails(
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "branch", required = false) String branch) {
    Map<Long, Map<String, Object>> uniqueRecords = new LinkedHashMap<>();
    String normalizedBranch = requestFilterService.normalizeBranch(branch);
    for (String today : dateCandidates(LocalDate.now())) {
        attendanceRecordRepository.findTodayPresentTimeInRowsByDateAndClientAndBranch(
                        today,
                        clientId,
                        normalizedBranch,
                        PageRequest.of(0, 200))
                .forEach(row -> {
                    Long attendanceId = asLong(row[0]);
                    int lateMinutes = calculateLateMinutesFromRow(row);
                    if (attendanceId != null && lateMinutes > 0) {
                        Map<String, Object> item = toTodayTimeInMap(row);
                        item.put("status", "Late");
                        item.put("lateMinutes", lateMinutes);
                        uniqueRecords.putIfAbsent(attendanceId, item);
                    }
                });
    }
    return ResponseEntity.ok(new ArrayList<>(uniqueRecords.values()));
}

private int calculateLateMinutesFromRow(Object[] row) {
    if (!(row[7] instanceof LocalDateTime timeIn)) {
        return 0;
    }
    LocalTime shiftStart = PayrollCompatibilityDefaults.parseFlexibleTime(row.length > 11 ? String.valueOf(row[11]) : null)
            .or(() -> PayrollCompatibilityDefaults.parseFlexibleTime(row.length > 12 ? String.valueOf(row[12]) : null))
            .orElse(PayrollCompatibilityDefaults.DEFAULT_SHIFT_START);
    long minutes = Duration.between(shiftStart, timeIn.toLocalTime()).toMinutes();
    return minutes > 0 ? (int) minutes : 0;
}
@GetMapping("/late-arrivals")
public ResponseEntity<List<Map<String, Object>>> getLateArrivalsByDate(@RequestParam String date) {
    // Example input: "30/05/2025"
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    LocalDate parsedDate;
    try {
        parsedDate = LocalDate.parse(date, formatter);
    } catch (DateTimeParseException e) {
        return ResponseEntity.badRequest().body(Collections.singletonList(Map.of("error", "Invalid date format. Use dd/MM/yyyy")));
    }

    List<AttendanceRecord> records = attendanceRecordRepository.findAllTimeInByDate(date);

    List<Map<String, Object>> result = records.stream()
        .filter(record -> {
            if (record.getTimeIn() != null && record.getEmployee() != null) {
                return attendanceMetricsService.calculateDailyLateMinutes(record) > 0;
            }
            return false;
        })
        .map(record -> {
            Map<String, Object> map = new HashMap<>();
            map.put("employeeId", record.getEmployee().getId());
            map.put("name", record.getEmployee().getFirstName());
            map.put("branch", record.getEmployee().getBranch());
            map.put("mobile", record.getEmployee().getMobile()); // Optional
            map.put("profileImage", record.getEmployee().getProfileImage()); // Optional
            map.put("timeIn", record.getTimeIn().toString());
            map.put("status", record.getAttendanceStatus());
            map.put("lateMinutes", attendanceMetricsService.calculateDailyLateMinutes(record));
            return map;
        })
        .collect(Collectors.toList());

    return ResponseEntity.ok(result);
}


@GetMapping("/summary")
public Map<String, Object> getDashboardSummary(
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam(value = "branch", required = false) String branch) {
    long totalStartNanos = System.nanoTime();
    Map<String, Object> summary = new HashMap<>();
    try {
        long schemaStartNanos = System.nanoTime();
        schemaMaintenanceService.ensureEmployeeSchema();
        long schemaMs = elapsedMs(schemaStartNanos, System.nanoTime());
        String normalizedBranch = requestFilterService.normalizeBranch(branch);

        DashboardSummaryResult result = buildDashboardSummary(LocalDate.now(), clientId, normalizedBranch);
        DashboardDaySummary today = result.today();
        DashboardDaySummary yesterday = result.yesterday();

        summary.put("totalEmployees", result.totalEmployees());
        summary.put("presentToday", today.present());
        summary.put("absentToday", Math.max(0L, result.totalEmployees() - today.present()));
        summary.put("lateArrivalsToday", today.late());
        summary.put("lateMinutesToday", today.lateMinutes());
        summary.put("onTimeToday", today.onTime());
        summary.put("presentYesterday", yesterday.present());
        summary.put("absentYesterday", Math.max(0L, result.totalEmployees() - yesterday.present()));
        summary.put("lateArrivalsYesterday", yesterday.late());
        summary.put("lateMinutesYesterday", yesterday.lateMinutes());
        summary.put("onTimeYesterday", yesterday.onTime());
        summary.put("absentChangePercent", calculatePercentageChange(
                Math.max(0L, result.totalEmployees() - yesterday.present()),
                Math.max(0L, result.totalEmployees() - today.present())));
        summary.put("lateChangePercent", calculatePercentageChange(yesterday.late(), today.late()));
        summary.put("onTimeChangePercent", calculatePercentageChange(yesterday.onTime(), today.onTime()));
        LOGGER.info(
                "dashboard-summary-timing clientId={} branch={} summaryDate={} employees={} records={} syntheticRecords={} schemaMs={} employeeFetchMs={} attendanceFetchMs={} additionalWorkingFetchMs={} syntheticBuildMs={} classificationMs={} countMs={} totalMs={}",
                clientId,
                normalizedBranch,
                result.summaryDate(),
                result.totalEmployees(),
                result.attendanceRecordCount(),
                result.syntheticRecordCount(),
                schemaMs,
                result.employeeFetchMs(),
                result.attendanceFetchMs(),
                result.additionalWorkingFetchMs(),
                result.syntheticBuildMs(),
                result.classificationMs(),
                result.countMs(),
                elapsedMs(totalStartNanos, System.nanoTime()));
        return summary;
    } catch (Exception ex) {
        LOGGER.error(
                "dashboard-summary-failed clientId={} branch={} totalMs={}",
                clientId,
                branch,
                elapsedMs(totalStartNanos, System.nanoTime()),
                ex);
        summary.put("totalEmployees", 0L);
        summary.put("presentToday", 0L);
        summary.put("absentToday", 0L);
        summary.put("lateArrivalsToday", 0L);
        summary.put("lateMinutesToday", 0);
        summary.put("onTimeToday", 0L);
        summary.put("presentYesterday", 0L);
        summary.put("absentYesterday", 0L);
        summary.put("lateArrivalsYesterday", 0L);
        summary.put("lateMinutesYesterday", 0);
        summary.put("onTimeYesterday", 0L);
        summary.put("absentChangePercent", 0.0);
        summary.put("lateChangePercent", 0.0);
        summary.put("onTimeChangePercent", 0.0);
        return summary;
    }
}

private DashboardSummaryResult buildDashboardSummary(LocalDate todayDate, Long clientId, String normalizedBranch) {
    LocalDate summaryDate = todayDate;
    LocalDate yesterdayDate = summaryDate.minusDays(1);
    List<LocalDate> summaryDates = List.of(summaryDate, yesterdayDate);

    long employeeFetchStartNanos = System.nanoTime();
    List<Object[]> employeeRows = employeeRepository.findDashboardEmployeeRows(clientId, normalizedBranch);
    long employeeFetchMs = elapsedMs(employeeFetchStartNanos, System.nanoTime());

    Map<Long, Map<String, Object>> employeesById = new LinkedHashMap<>();
    for (Object[] employeeRow : employeeRows) {
        Map<String, Object> employee = toDashboardEmployeeMap(employeeRow);
        Long employeeId = asLong(employee.get("employeeId"));
        if (employeeId != null) {
            employeesById.put(employeeId, employee);
        }
    }

    List<String> dateValues = summaryDates.stream()
            .flatMap(date -> dateCandidates(date).stream())
            .distinct()
            .toList();

    long attendanceFetchStartNanos = System.nanoTime();
    List<Object[]> rows = dateValues.isEmpty()
            ? List.of()
            : attendanceRecordRepository.findDashboardSummaryRowsByDatesAndClient(
                    dateValues,
                    clientId,
                    normalizedBranch);
    long attendanceFetchMs = elapsedMs(attendanceFetchStartNanos, System.nanoTime());

    Map<String, Map<String, Object>> latestRecordByDateAndEmployee = new LinkedHashMap<>();
    for (Object[] row : rows) {
        Map<String, Object> record = toDashboardRecordMap(row);
        Long employeeId = asLong(record.get("employeeId"));
        if (employeeId == null || !employeesById.containsKey(employeeId)) {
            continue;
        }
        LocalDate recordDate = parseDashboardRecordDate(String.valueOf(record.getOrDefault("date", "")));
        if (recordDate == null || !summaryDates.contains(recordDate)) {
            continue;
        }
        latestRecordByDateAndEmployee.putIfAbsent(dashboardKey(recordDate, employeeId), record);
    }

    long syntheticBuildStartNanos = System.nanoTime();
    List<Map<String, Object>> recordsForClassification = new ArrayList<>(latestRecordByDateAndEmployee.values());
    int syntheticRecordCount = 0;
    for (LocalDate date : summaryDates) {
        for (Map<String, Object> employee : employeesById.values()) {
            Long employeeId = asLong(employee.get("employeeId"));
            if (employeeId != null && !latestRecordByDateAndEmployee.containsKey(dashboardKey(date, employeeId))) {
                recordsForClassification.add(toDashboardSyntheticRecord(employee, date));
                syntheticRecordCount++;
            }
        }
    }
    long syntheticBuildMs = elapsedMs(syntheticBuildStartNanos, System.nanoTime());

    long additionalFetchStartNanos = System.nanoTime();
    Map<Long, List<EmployeeAdditionalWorkingDay>> additionalWorkingDays =
            additionalWorkingDayService.findUniqueEntitiesByEmployeeIds(employeesById.keySet());
    long additionalWorkingFetchMs = elapsedMs(additionalFetchStartNanos, System.nanoTime());

    long classificationStartNanos = System.nanoTime();
    List<Map<String, Object>> classified = attendanceClassificationService.classifyRecordMaps(
            recordsForClassification,
            clientId,
            additionalWorkingDays);
    long classificationMs = elapsedMs(classificationStartNanos, System.nanoTime());

    long countStartNanos = System.nanoTime();
    Map<LocalDate, DashboardDaySummary> summaries = new HashMap<>();
    for (Map<String, Object> row : classified) {
        LocalDate rowDate = parseDashboardRecordDate(String.valueOf(row.getOrDefault("date", "")));
        if (rowDate == null || !summaryDates.contains(rowDate)) {
            continue;
        }
        summaries.compute(rowDate, (ignored, current) -> incrementDashboardSummary(current, row));
    }
    long countMs = elapsedMs(countStartNanos, System.nanoTime());

    return new DashboardSummaryResult(
            employeesById.size(),
            summaryDate,
            summaries.getOrDefault(summaryDate, DashboardDaySummary.empty()),
            summaries.getOrDefault(yesterdayDate, DashboardDaySummary.empty()),
            rows.size(),
            syntheticRecordCount,
            employeeFetchMs,
            attendanceFetchMs,
            additionalWorkingFetchMs,
            syntheticBuildMs,
            classificationMs,
            countMs,
            classified);
}

private long countDashboardEmployees(Long clientId, String branch) {
    if (branch == null || branch.isBlank()) {
        return clientId == null ? employeeRepository.count() : employeeRepository.countByClientId(clientId);
    }
    return clientId == null
            ? employeeRepository.countByBranchIgnoreCase(branch)
            : employeeRepository.countByClientIdAndBranchIgnoreCase(clientId, branch);
}

private DashboardDaySummary classifyDashboardDay(LocalDate date, Long clientId, String normalizedBranch) {
    List<Employee> employees = loadDashboardEmployees(clientId, normalizedBranch);
    Map<Long, Employee> employeesById = new LinkedHashMap<>();
    for (Employee employee : employees) {
        if (employee != null && employee.getId() != null) {
            employeesById.put(employee.getId(), employee);
        }
    }

    List<AttendanceRecord> records = attendanceRecordRepository.findByDatesAndClientOrderByIdDesc(
            dateCandidates(date),
            clientId,
            normalizedBranch);
    Map<Long, AttendanceRecord> latestRecordByEmployee = new LinkedHashMap<>();
    for (AttendanceRecord record : records) {
        if (record == null || record.getEmployee() == null || record.getEmployee().getId() == null) {
            continue;
        }
        Long employeeId = record.getEmployee().getId();
        if (!employeesById.containsKey(employeeId)) {
            continue;
        }
        latestRecordByEmployee.putIfAbsent(employeeId, record);
    }

    List<Map<String, Object>> classified = new ArrayList<>(
            attendanceClassificationService.classifyRecords(
                    new ArrayList<>(latestRecordByEmployee.values()),
                    clientId));

    Set<Long> employeeIdsWithRecords = new HashSet<>(latestRecordByEmployee.keySet());
    List<Map<String, Object>> missingRecords = new ArrayList<>();
    for (Employee employee : employeesById.values()) {
        if (!employeeIdsWithRecords.contains(employee.getId())) {
            missingRecords.add(toDashboardSyntheticRecord(employee, date));
        }
    }
    classified.addAll(attendanceClassificationService.classifyRecordMaps(missingRecords, clientId));

    long present = 0L;
    long absent = 0L;
    long late = 0L;
    long lateMinutes = 0L;
    for (Map<String, Object> row : classified) {
        String countStatus = String.valueOf(row.getOrDefault("countStatus", ""));
        int rowLateMinutes = intValue(row.get("lateMinutes"));
        if ("Present".equalsIgnoreCase(countStatus)) {
            present++;
            if (rowLateMinutes > 0) {
                late++;
                lateMinutes += rowLateMinutes;
            }
        } else if ("Absent".equalsIgnoreCase(countStatus)) {
            absent++;
        }
    }
    long onTime = Math.max(0L, present - late);
    return new DashboardDaySummary(present, absent, late, lateMinutes, onTime);
}

private List<Employee> loadDashboardEmployees(Long clientId, String normalizedBranch) {
    if (normalizedBranch == null || normalizedBranch.isBlank()) {
        return clientId == null ? employeeRepository.findAll() : employeeRepository.findByClientId(clientId);
    }
    return clientId == null
            ? employeeRepository.findByBranchIgnoreCase(normalizedBranch)
            : employeeRepository.findByClientIdAndBranchIgnoreCase(clientId, normalizedBranch);
}

private Map<String, Object> toDashboardRecordMap(AttendanceRecord source) {
    Map<String, Object> record = new LinkedHashMap<>();
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

    Employee employee = source.getEmployee();
    if (employee != null) {
        record.put("employeeId", employee.getId());
        Map<String, Object> employeeMap = new LinkedHashMap<>();
        employeeMap.put("id", employee.getId());
        employeeMap.put("employeeId", employee.getId());
        employeeMap.put("firstName", employee.getFirstName());
        employeeMap.put("lastName", employee.getLastName());
        employeeMap.put("branch", employee.getBranch());
        employeeMap.put("employeeCode", employee.getEmployeeCode());
        employeeMap.put("weekOff", employee.getWeekOff());
        employeeMap.put("shiftStartTime", employee.getShiftStartTime());
        employeeMap.put("shiftEndTime", employee.getShiftEndTime());
        employeeMap.put("shiftStart", employee.getShiftStart());
        employeeMap.put("shiftEnd", employee.getShiftEnd());
        employeeMap.put("leavePolicyType", employee.getLeavePolicyType());
        record.put("employee", employeeMap);
    }
    return record;
}

private Map<String, Object> toDashboardRecordMap(Object[] row) {
    Map<String, Object> record = new LinkedHashMap<>();
    if (row == null) {
        return record;
    }
    record.put("id", valueAt(row, 0));
    record.put("timeIn", valueAt(row, 1));
    record.put("timeOut", valueAt(row, 2));
    record.put("dayStatus", valueAt(row, 3));
    record.put("location", valueAt(row, 4));
    record.put("attendanceStatus", valueAt(row, 5));
    record.put("date", valueAt(row, 6));
    record.put("missedTimes", valueAt(row, 7));
    record.put("workedHours", valueAt(row, 8));
    record.put("overtime", valueAt(row, 9));
    record.put("permissionUsed", valueAt(row, 10));
    record.put("shiftId", valueAt(row, 11));
    record.put("employeeId", valueAt(row, 12));

    Map<String, Object> employeeMap = new LinkedHashMap<>();
    employeeMap.put("id", valueAt(row, 12));
    employeeMap.put("employeeId", valueAt(row, 12));
    employeeMap.put("firstName", valueAt(row, 13));
    employeeMap.put("lastName", valueAt(row, 14));
    employeeMap.put("branch", valueAt(row, 15));
    employeeMap.put("employeeCode", valueAt(row, 16));
    employeeMap.put("weekOff", valueAt(row, 17));
    employeeMap.put("mobile", valueAt(row, 18));
    employeeMap.put("shiftStartTime", valueAt(row, 19));
    employeeMap.put("shiftEndTime", valueAt(row, 20));
    employeeMap.put("shiftStart", valueAt(row, 21));
    employeeMap.put("shiftEnd", valueAt(row, 22));
    employeeMap.put("leavePolicyType", valueAt(row, 23));
    record.put("employee", employeeMap);
    return record;
}

private Object valueAt(Object[] row, int index) {
    return row != null && row.length > index ? row[index] : null;
}

private Map<String, Object> toDashboardEmployeeMap(Object[] row) {
    Map<String, Object> employeeMap = new LinkedHashMap<>();
    Object employeeId = valueAt(row, 0);
    employeeMap.put("id", employeeId);
    employeeMap.put("employeeId", employeeId);
    employeeMap.put("firstName", valueAt(row, 1));
    employeeMap.put("lastName", valueAt(row, 2));
    employeeMap.put("branch", valueAt(row, 3));
    employeeMap.put("employeeCode", valueAt(row, 4));
    employeeMap.put("weekOff", valueAt(row, 5));
    employeeMap.put("mobile", valueAt(row, 6));
    employeeMap.put("shiftStartTime", valueAt(row, 7));
    employeeMap.put("shiftEndTime", valueAt(row, 8));
    employeeMap.put("shiftStart", valueAt(row, 9));
    employeeMap.put("shiftEnd", valueAt(row, 10));
    employeeMap.put("leavePolicyType", valueAt(row, 11));
    return employeeMap;
}

private Map<String, Object> toDashboardSyntheticRecord(Employee employee, LocalDate date) {
    Map<String, Object> record = new LinkedHashMap<>();
    record.put("date", date == null ? null : date.format(dateFormatter));
    record.put("employeeId", employee.getId());
    record.put("attendanceStatus", "Absent");
    record.put("dayStatus", "");
    Map<String, Object> employeeMap = new LinkedHashMap<>();
    employeeMap.put("id", employee.getId());
    employeeMap.put("employeeId", employee.getId());
    employeeMap.put("firstName", employee.getFirstName());
    employeeMap.put("lastName", employee.getLastName());
    employeeMap.put("branch", employee.getBranch());
    employeeMap.put("employeeCode", employee.getEmployeeCode());
    employeeMap.put("weekOff", employee.getWeekOff());
    employeeMap.put("shiftStartTime", employee.getShiftStartTime());
    employeeMap.put("shiftEndTime", employee.getShiftEndTime());
    employeeMap.put("shiftStart", employee.getShiftStart());
    employeeMap.put("shiftEnd", employee.getShiftEnd());
    employeeMap.put("leavePolicyType", employee.getLeavePolicyType());
    record.put("employee", employeeMap);
    return record;
}

private Map<String, Object> toDashboardSyntheticRecord(Map<String, Object> employee, LocalDate date) {
    Map<String, Object> record = new LinkedHashMap<>();
    record.put("date", date == null ? null : date.format(dateFormatter));
    record.put("employeeId", employee.get("employeeId"));
    record.put("attendanceStatus", "Absent");
    record.put("dayStatus", "");
    record.put("employee", new LinkedHashMap<>(employee));
    return record;
}

private Map<String, Object> toAbsentPopupEmployee(Map<String, Object> classifiedRecord, String status) {
    Map<String, Object> employee = classifiedRecord.get("employee") instanceof Map<?, ?> employeeMap
            ? new LinkedHashMap<>((Map<String, Object>) employeeMap)
            : new LinkedHashMap<>();
    String firstName = String.valueOf(employee.getOrDefault("firstName", "")).trim();
    String lastName = String.valueOf(employee.getOrDefault("lastName", "")).trim();
    String fullName = (firstName + " " + lastName).trim();

    Map<String, Object> item = new LinkedHashMap<>();
    item.put("id", employee.getOrDefault("id", classifiedRecord.get("employeeId")));
    item.put("name", fullName.isBlank() ? firstName : fullName);
    item.put("firstName", firstName);
    item.put("lastName", lastName);
    item.put("branch", employee.get("branch"));
    item.put("mobile", employee.get("mobile"));
    item.put("date", classifiedRecord.get("date"));
    item.put("status", status);
    item.put("displayStatus", status);
    item.put("countStatus", classifiedRecord.get("countStatus"));
    return item;
}

private DashboardDaySummary incrementDashboardSummary(DashboardDaySummary current, Map<String, Object> row) {
    DashboardDaySummary base = current == null ? DashboardDaySummary.empty() : current;
    String countStatus = String.valueOf(row.getOrDefault("countStatus", ""));
    int rowLateMinutes = intValue(row.get("lateMinutes"));
    if ("Present".equalsIgnoreCase(countStatus)) {
        long lateIncrement = rowLateMinutes > 0 ? 1L : 0L;
        return new DashboardDaySummary(
                base.present() + 1,
                base.absent(),
                base.late() + lateIncrement,
                base.lateMinutes() + (rowLateMinutes > 0 ? rowLateMinutes : 0),
                Math.max(0L, base.present() + 1 - (base.late() + lateIncrement)));
    }
    if ("Absent".equalsIgnoreCase(countStatus)) {
        return new DashboardDaySummary(
                base.present(),
                base.absent() + 1,
                base.late(),
                base.lateMinutes(),
                Math.max(0L, base.present() - base.late()));
    }
    return base;
}

private int intValue(Object value) {
    if (value instanceof Number number) {
        return number.intValue();
    }
    try {
        return Integer.parseInt(String.valueOf(value));
    } catch (Exception ignored) {
        return 0;
    }
}

private long elapsedMs(long startNanos, long endNanos) {
    return Math.max(0L, (endNanos - startNanos) / 1_000_000L);
}

private record DashboardDaySummary(long present, long absent, long late, long lateMinutes, long onTime) {
    private static DashboardDaySummary empty() {
        return new DashboardDaySummary(0L, 0L, 0L, 0L, 0L);
    }
}

private record DashboardSummaryResult(
        long totalEmployees,
        LocalDate summaryDate,
        DashboardDaySummary today,
        DashboardDaySummary yesterday,
        int attendanceRecordCount,
        int syntheticRecordCount,
        long employeeFetchMs,
        long attendanceFetchMs,
        long additionalWorkingFetchMs,
        long syntheticBuildMs,
        long classificationMs,
        long countMs,
        List<Map<String, Object>> classifiedRecords) {
}

private List<String> dateCandidates(LocalDate date) {
    if (date == null) {
        return List.of();
    }
    return List.of(
            date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
            date.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
            date.format(DateTimeFormatter.ofPattern("dd-MM-yyyy"))
    );
}

private String dashboardKey(LocalDate date, Long employeeId) {
    return (date == null ? "" : date.toString()) + ":" + employeeId;
}

private LocalDate parseDashboardRecordDate(String rawDate) {
    if (rawDate == null || rawDate.isBlank()) {
        return null;
    }
    String value = rawDate.trim();
    for (DateTimeFormatter formatter : List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd-MM-yyyy"))) {
        try {
            return LocalDate.parse(value, formatter);
        } catch (DateTimeParseException ignored) {
            // Try next dashboard-supported date format.
        }
    }
    return null;
}

private List<AttendanceRecord> findRecordsByDateFlexible(LocalDate date) {
    if (date == null) {
        return new ArrayList<>();
    }
    List<String> candidates = List.of(
            date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
            date.format(DateTimeFormatter.ofPattern("yyyy-MM-dd")),
            date.format(DateTimeFormatter.ofPattern("dd-MM-yyyy"))
    );
    Map<Long, AttendanceRecord> unique = new LinkedHashMap<>();
    for (String dateValue : candidates) {
        List<AttendanceRecord> records = attendanceRecordRepository.findByDate(dateValue);
        for (AttendanceRecord record : records) {
            if (record != null && record.getId() != null) {
                unique.putIfAbsent(record.getId(), record);
            }
        }
    }
    return new ArrayList<>(unique.values());
}

private double calculatePercentageChange(long oldValue, long newValue) {
    if (oldValue == 0 && newValue == 0) return 0.0;
    if (oldValue == 0) return 100.0; // from 0 to something = 100% increase
    return ((double) (newValue - oldValue) / oldValue) * 100;
}

//////////////////////filter
@GetMapping("/monthly-summary")
public ResponseEntity<?> getEmployeeMonthlySummary(
        @RequestParam String employeeId,
        @RequestParam(value = "clientId", required = false) Long clientId,
        @RequestParam int month,
        @RequestParam int year) {

    Optional<Employee> employeeOpt = resolveEmployeeByRef(employeeId, clientId);
    if (employeeOpt.isEmpty()) {
        Map<String, String> error = new HashMap<>();
        error.put("message", "Employee not found");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }
    Employee employee = employeeOpt.get();
    Long resolvedEmployeeId = employee.getId();
    reconcileApprovedSwapWeekoffs(resolvedEmployeeId, year, month);

    AttendanceMetricsService.MonthlyMetrics metrics =
            attendanceMetricsService.calculateMonthlyMetrics(resolvedEmployeeId, month, year);

    // Total days in the month
    int daysInMonth = java.time.YearMonth.of(year, month).lengthOfMonth();

    // Prepare response
    Map<String, Object> response = new HashMap<>();
    response.put("employeeId", resolvedEmployeeId);
    response.put("firstName", employee.getFirstName());
    response.put("lastName", employee.getLastName());
    response.put("branch", employee.getBranch());
    response.put("position", employee.getPosition());
    response.put("mobile", employee.getMobile());
    response.put("dob", employee.getDob());
    response.put("email", employee.getEmail());
    response.put("address", employee.getAddress());
    response.put("salary", employee.getSalary());
    response.put("absentCount", metrics.absentCount());
    response.put("presentCount", metrics.presentCount());
    response.put("workingDays", metrics.presentCount());
    response.put("lateDays", metrics.monthlyLateDays());
    response.put("totalLateMinutes", metrics.monthlyLateMinutes());
    response.put("totalEarlyOutMinutes", metrics.monthlyEarlyOutMinutes());
    response.put("totalMissedTimes", metrics.totalMissedMinutes());
    response.put("permissionCount", metrics.approvedPermissionCount());
    response.put("totalApprovedPermissionsTaken", metrics.approvedPermissionCount());
    response.put("approvedPermissionCount", metrics.approvedPermissionCount());
    response.put("approvedPermissionMinutes", metrics.approvedPermissionMinutes());
    response.put("maxPermissionsPerMonth", attendanceMetricsService.resolveMaxApprovedPermissionsPerMonth(employee));
    response.put("maxPermissionMinutesPerMonth", attendanceMetricsService.resolveMaxApprovedPermissionMinutesPerMonth(employee));
    response.put("daysInMonth", daysInMonth);

    return ResponseEntity.ok(response);
}

private void reconcileApprovedSwapWeekoffs(Long employeeId, int year, int month) {
    if (employeeId == null) {
        return;
    }

    Optional<Employee> employeeOpt = employeeRepository.findById(employeeId);
    if (employeeOpt.isEmpty()) {
        return;
    }

    Employee employee = employeeOpt.get();
    List<LeavePermission> approvedLeaves =
            leavePermissionRepository.findByEmployeeIdAndStatus(employeeId, "approved");
    for (LeavePermission leave : approvedLeaves) {
        if (!isSwapWeekoffType(leave.getLeaveType())) {
            continue;
        }

        LocalDate start = parseDbDate(firstNonBlank(leave.getStartDate(), leave.getDate()));
        LocalDate end = parseDbDate(firstNonBlank(leave.getEndDate(), leave.getStartDate(), leave.getDate()));
        if (start == null) {
            continue;
        }
        if (end == null) {
            end = start;
        }

        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            if (date.getYear() == year && date.getMonthValue() == month) {
                upsertSwapWeekoffAttendance(employee, date);
            }
        }
    }
}

private void upsertSwapWeekoffAttendance(Employee employee, LocalDate date) {
    String formattedDate = date.format(dateFormatter);
    List<AttendanceRecord> existingRecords =
            attendanceRecordRepository.findByEmployeeIdAndDate(employee.getId(), formattedDate);
    AttendanceRecord record = existingRecords.isEmpty() ? new AttendanceRecord() : existingRecords.get(0);

    record.setEmployee(employee);
    record.setDate(formattedDate);
    record.setAttendanceStatus("Week Off");
    record.setDayStatus("Week Off");
    record.setLocation("Swap Weekoff Approved");
    record.setAttendancelocation("Swap Weekoff Approved");
    record.setMissedTimes(0);
    record.setWorkedHours(0.0);
    record.setOvertime(0.0);
    record.setPermissionUsed(0.0);
    attendanceRecordRepository.save(record);

    for (int i = 1; i < existingRecords.size(); i++) {
        AttendanceRecord duplicate = existingRecords.get(i);
        if (duplicate.getTimeIn() == null && duplicate.getTimeOut() == null) {
            attendanceRecordRepository.delete(duplicate);
        }
    }
}

private boolean isSwapWeekoffType(String leaveTypeRaw) {
    return leaveTypeRaw != null && leaveTypeRaw.trim().equalsIgnoreCase("Swap Weekoff");
}

private LocalDate parseDbDate(String rawDate) {
    if (rawDate == null || rawDate.isBlank()) {
        return null;
    }
    try {
        return LocalDate.parse(rawDate.trim(), dateFormatter);
    } catch (DateTimeParseException ex) {
        return null;
    }
}

private String firstNonBlank(String... values) {
    if (values == null) {
        return null;
    }
    for (String value : values) {
        if (value != null && !value.isBlank()) {
            return value;
        }
    }
    return null;
}

private Optional<Employee> resolveEmployeeByRef(String employeeRef, Long clientId) {
    if (employeeRef == null || employeeRef.isBlank()) {
        return Optional.empty();
    }

    String normalized = employeeRef.trim();

    try {
        Long id = Long.parseLong(normalized);
        return clientId == null
                ? employeeRepository.findById(id)
                : employeeRepository.findByIdAndClientId(id, clientId);
    } catch (NumberFormatException ignored) {
        // Continue with employee-code lookup.
    }

    Optional<Employee> byCode = employeeRepository.findByEmployeeCode(normalized.toUpperCase());
    if (byCode.isPresent()
            && (clientId == null || clientId.equals(byCode.get().getClientId()))) {
        return byCode;
    }

    Matcher matcher = Pattern.compile("(?i)(?:^|\\.)EMP(\\d+)$").matcher(normalized);
    if (matcher.find()) {
        try {
            Long id = Long.parseLong(matcher.group(1));
            return clientId == null
                    ? employeeRepository.findById(id)
                    : employeeRepository.findByIdAndClientId(id, clientId);
        } catch (NumberFormatException ignored) {
            // Keep empty below.
        }
    }

    return Optional.empty();
}

private LocalTime parseShiftEnd(String raw) {
    if (raw == null || raw.isBlank()) {
        return PayrollCompatibilityDefaults.DEFAULT_SHIFT_END;
    }
    try {
        return LocalTime.parse(raw.trim(), TIME_FORMATTER_HH_MM_SS);
    } catch (DateTimeParseException ignored) {
        // Fallback below
    }
    try {
        return LocalTime.parse(raw.trim(), TIME_FORMATTER_HH_MM);
    } catch (DateTimeParseException ignored) {
        return PayrollCompatibilityDefaults.DEFAULT_SHIFT_END;
    }
}

private void updateDerivedAttendanceHours(AttendanceRecord record) {
    if (record == null || record.getTimeIn() == null || record.getTimeOut() == null) {
        return;
    }
    if (!record.getTimeOut().isAfter(record.getTimeIn())) {
        return;
    }

    LocalDateTime shiftStart = record.getTimeIn()
            .toLocalDate()
            .atTime(resolveShiftStart(record));
    LocalDateTime shiftEnd = record.getTimeIn()
            .toLocalDate()
            .atTime(resolveShiftEnd(record));
    if (!shiftEnd.isAfter(shiftStart)) {
        shiftEnd = shiftEnd.plusDays(1);
    }
    LocalDateTime payableStart = record.getTimeIn().isAfter(shiftStart) ? record.getTimeIn() : shiftStart;
    LocalDateTime payableEnd = record.getTimeOut().isBefore(shiftEnd) ? record.getTimeOut() : shiftEnd;
    long workedMinutes = payableEnd.isAfter(payableStart)
            ? Duration.between(payableStart, payableEnd).toMinutes()
            : 0;
    record.setWorkedHours(Math.round((workedMinutes / 60.0) * 100.0) / 100.0);

    LocalTime shiftEndTime = resolveShiftEnd(record);
    LocalTime actualOut = record.getTimeOut().toLocalTime();
    long overtimeMinutes = actualOut.isAfter(shiftEndTime)
            ? Duration.between(shiftEndTime, actualOut).toMinutes()
            : 0;
    record.setOvertime(Math.round((Math.max(0, overtimeMinutes) / 60.0) * 100.0) / 100.0);
}

private void applyShiftSnapshotIfMissing(AttendanceRecord record) {
    if (record == null || record.getExpectedShiftStart() != null || record.getExpectedShiftEnd() != null) {
        return;
    }
    Employee employee = record.getEmployee();
    LocalDate date = resolveAttendanceRecordDate(record);
    applyShiftSnapshot(record, employee, date, employee == null ? null : employee.getClientId());
}

private void applyShiftSnapshot(AttendanceRecord record, Employee employee, LocalDate date, Long clientId) {
    if (record == null || employee == null || date == null) {
        return;
    }
    ShiftResolverService.ShiftResolution resolution = shiftResolverService.resolve(employee, date, clientId);
    record.setExpectedShiftStart(resolution.expectedShiftStartText());
    record.setExpectedShiftEnd(resolution.expectedShiftEndText());
    record.setExpectedMinutes(resolution.expectedMinutes());
    record.setShiftSource(resolution.shiftSource());
}

private LocalDate resolveAttendanceRecordDate(AttendanceRecord record) {
    if (record == null) {
        return null;
    }
    if (record.getDate() != null && !record.getDate().isBlank()) {
        try {
            return LocalDate.parse(record.getDate().trim(), dateFormatter);
        } catch (DateTimeParseException ignored) {
            // Use punch date fallback below.
        }
    }
    if (record.getTimeIn() != null) {
        return record.getTimeIn().toLocalDate();
    }
    if (record.getTimeOut() != null) {
        return record.getTimeOut().toLocalDate();
    }
    return null;
}

private LocalTime resolveShiftStart(AttendanceRecord record) {
    return shiftResolverService.parseFlexibleTime(record == null ? null : record.getExpectedShiftStart())
            .orElseGet(() -> PayrollCompatibilityDefaults.resolveShiftStart(record == null ? null : record.getEmployee()));
}

private LocalTime resolveShiftEnd(AttendanceRecord record) {
    return shiftResolverService.parseFlexibleTime(record == null ? null : record.getExpectedShiftEnd())
            .orElseGet(() -> PayrollCompatibilityDefaults.resolveShiftEnd(record == null ? null : record.getEmployee()));
}


}
