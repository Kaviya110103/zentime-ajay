package com.example.demo.service;

import com.example.demo.MODELS.AttendanceRecord;
import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.EmployeeAdditionalWorkingDay;
import com.example.demo.MODELS.Holiday;
import com.example.demo.repo.HolidayRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class AttendanceClassificationService {
    private static final DateTimeFormatter DATE_DD_MM_YYYY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_DD_MM_YYYY_DASH = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final DateTimeFormatter TIME_HH_MM = DateTimeFormatter.ofPattern("H:mm");
    private static final DateTimeFormatter TIME_HH_MM_SS = DateTimeFormatter.ofPattern("H:mm:ss");

    private final AdditionalWorkingDayService additionalWorkingDayService;
    private final HolidayRepository holidayRepository;
    private final ShiftResolverService shiftResolverService;

    public AttendanceClassificationService(
            AdditionalWorkingDayService additionalWorkingDayService,
            HolidayRepository holidayRepository,
            ShiftResolverService shiftResolverService) {
        this.additionalWorkingDayService = additionalWorkingDayService;
        this.holidayRepository = holidayRepository;
        this.shiftResolverService = shiftResolverService;
    }

    public List<Map<String, Object>> classifyRecordMaps(List<Map<String, Object>> records, Long clientId) {
        if (records == null || records.isEmpty()) {
            return List.of();
        }
        BatchContext context = buildBatchContext(records, clientId);
        return classifyRecordMaps(records, context);
    }

    public List<Map<String, Object>> classifyRecordMaps(
            List<Map<String, Object>> records,
            Long clientId,
            Map<Long, List<EmployeeAdditionalWorkingDay>> preloadedAdditionalWorkingDays) {
        if (records == null || records.isEmpty()) {
            return List.of();
        }
        BatchContext context = buildBatchContext(records, clientId, preloadedAdditionalWorkingDays);
        return classifyRecordMaps(records, context);
    }

    private List<Map<String, Object>> classifyRecordMaps(List<Map<String, Object>> records, BatchContext context) {
        return records.stream()
                .filter(Objects::nonNull)
                .map(record -> classifyRecordMap(record, context))
                .toList();
    }

    public List<Map<String, Object>> classifyRecords(List<AttendanceRecord> records, Long clientId) {
        if (records == null || records.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> maps = records.stream()
                .filter(Objects::nonNull)
                .map(this::toRecordMap)
                .toList();
        return classifyRecordMaps(maps, clientId);
    }

    public Map<String, Object> classifyRecord(AttendanceRecord record, Long clientId) {
        if (record == null) {
            return Map.of();
        }
        return classifyRecordMaps(List.of(toRecordMap(record)), clientId).stream()
                .findFirst()
                .orElseGet(LinkedHashMap::new);
    }

    public List<Map<String, Object>> classifyCalendar(Employee employee, LocalDate start, LocalDate end, Long clientId) {
        if (employee == null || employee.getId() == null || start == null || end == null || end.isBefore(start)) {
            return List.of();
        }
        List<Map<String, Object>> records = new ArrayList<>();
        Map<String, Object> employeeMap = toEmployeeMap(employee);
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            Map<String, Object> record = new LinkedHashMap<>();
            record.put("date", date.format(DATE_DD_MM_YYYY));
            record.put("employeeId", employee.getId());
            record.put("employee", employeeMap);
            record.put("attendanceStatus", "");
            record.put("dayStatus", "");
            records.add(record);
        }
        return classifyRecordMaps(records, clientId);
    }

    private BatchContext buildBatchContext(List<Map<String, Object>> records, Long clientId) {
        return buildBatchContext(records, clientId, null);
    }

    private BatchContext buildBatchContext(
            List<Map<String, Object>> records,
            Long clientId,
            Map<Long, List<EmployeeAdditionalWorkingDay>> preloadedAdditionalWorkingDays) {
        List<LocalDate> dates = records.stream()
                .map(this::resolveRecordDate)
                .filter(Objects::nonNull)
                .toList();

        Map<LocalDate, List<Holiday>> holidaysByDate = Map.of();
        if (clientId != null && !dates.isEmpty()) {
            LocalDate start = dates.stream().min(Comparator.naturalOrder()).orElse(null);
            LocalDate end = dates.stream().max(Comparator.naturalOrder()).orElse(null);
            if (start != null && end != null) {
                holidaysByDate = holidayRepository
                        .findByClientIdAndHolidayDateBetweenOrderByHolidayDateAsc(clientId, start, end)
                        .stream()
                        .filter(holiday -> holiday.getHolidayDate() != null)
                        .collect(Collectors.groupingBy(Holiday::getHolidayDate));
            }
        }

        List<Long> employeeIds = records.stream()
                .map(this::resolveEmployeeId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, List<EmployeeAdditionalWorkingDay>> additionalByEmployee =
                preloadedAdditionalWorkingDays == null
                        ? additionalWorkingDayService.findUniqueEntitiesByEmployeeIds(employeeIds)
                        : preloadedAdditionalWorkingDays;

        return new BatchContext(holidaysByDate, additionalByEmployee);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> classifyRecordMap(Map<String, Object> source, BatchContext context) {
        Map<String, Object> record = new LinkedHashMap<>(source);
        Map<String, Object> employee = source.get("employee") instanceof Map<?, ?> employeeMap
                ? new LinkedHashMap<>((Map<String, Object>) employeeMap)
                : new LinkedHashMap<>();

        Long employeeId = resolveEmployeeId(source);
        LocalDate recordDate = resolveRecordDate(source);
        LocalDateTime timeIn = parseDateTime(source.get("timeIn"), recordDate);
        LocalDateTime timeOut = parseDateTime(source.get("timeOut"), recordDate);
        boolean hasPunch = timeIn != null || timeOut != null;

        String rawStatus = text(source.get("attendanceStatus"));
        String rawDayStatus = text(source.get("dayStatus"));
        String normalizedStatus = normalize(rawStatus);
        String normalizedDayStatus = normalize(rawDayStatus);

        List<EmployeeAdditionalWorkingDay> additionalRows =
                employeeId == null ? List.of() : context.additionalWorkingDaysByEmployeeId()
                        .getOrDefault(employeeId, List.of());
        List<Map<String, Object>> additionalPayload = additionalRows.stream()
                .map(this::toAdditionalWorkingDayMap)
                .toList();
        if (!additionalPayload.isEmpty()) {
            employee.put("additionalWorkingDays", additionalPayload);
        }

        List<Holiday> dateHolidays = recordDate == null
                ? List.of()
                : context.holidaysByDate().getOrDefault(recordDate, List.of());
        ShiftResolverService.ShiftResolution shiftWindow = shiftResolverService.resolveWithSnapshot(
                source,
                employee,
                recordDate,
                dateHolidays,
                additionalRows);
        boolean holiday = shiftWindow.holiday();
        boolean scheduledAdditionalWork = shiftWindow.additionalWorkingDay();
        boolean effectiveWeekOff = shiftWindow.weekOff();
        boolean scheduledWorkingDay = shiftWindow.scheduledWorkingDay();
        boolean nonWorkingDisplayDay = holiday || effectiveWeekOff;
        int workedMinutes = calculateWorkedMinutes(source, timeIn, timeOut);
        int lateMinutes = calculateLateMinutes(shiftWindow, timeIn);
        int earlyOutMinutes = calculateEarlyOutMinutes(shiftWindow, timeOut);
        int calculatedMissedMinutes = shiftWindow.expectedMinutes() > 0 && hasPunch
                ? lateMinutes + earlyOutMinutes
                : Math.max(0, number(source.get("missedTimes")));

        boolean markedPresent = normalizedStatus.contains("present")
                || normalizedDayStatus.contains("present")
                || hasPunch;
        boolean leave = normalizedStatus.contains("leave")
                || (normalizedDayStatus.contains("leave") && normalizedStatus.isBlank());
        boolean halfDay = normalizedStatus.contains("half") || normalizedDayStatus.contains("half");
        boolean absent = normalizedStatus.contains("absent");

        String displayStatus;
        if (markedPresent) {
            displayStatus = "Present";
        } else if (effectiveWeekOff) {
            displayStatus = "Week Off";
        } else if (holiday) {
            displayStatus = "Holiday";
        } else if (halfDay) {
            displayStatus = "Half Day";
        } else if (leave) {
            displayStatus = "Leave";
        } else if (absent || (scheduledWorkingDay && !hasPunch)) {
            displayStatus = "Absent";
        } else {
            displayStatus = rawStatus.isBlank() ? "-" : rawStatus;
        }

        String countStatus;
        if (markedPresent) {
            countStatus = "Present";
        } else if (effectiveWeekOff) {
            countStatus = "Week Off";
        } else if (holiday) {
            countStatus = "Holiday";
        } else if (halfDay) {
            countStatus = "Half Day";
        } else if (leave) {
            countStatus = "Leave";
        } else if (scheduledWorkingDay) {
            countStatus = "Absent";
        } else if (absent) {
            countStatus = "Absent";
        } else {
            countStatus = displayStatus;
        }

        boolean payable = "Present".equals(countStatus)
                || "Week Off".equals(countStatus)
                || "Holiday".equals(countStatus)
                || "Leave".equals(countStatus)
                || "Half Day".equals(countStatus);
        String payableStatus = payable ? "Payable" : "Unpaid";
        int payableMinutes = calculatePayableMinutes(countStatus, workedMinutes, lateMinutes);

        record.put("employee", employee);
        record.put("displayStatus", displayStatus);
        record.put("countStatus", countStatus);
        record.put("payableStatus", payableStatus);
        record.put("payable", payable);
        record.put("workedOnNonWorkingDay", hasPunch && nonWorkingDisplayDay);
        record.put("holiday", holiday);
        record.put("weekOff", effectiveWeekOff);
        record.put("additionalWorkingDay", scheduledAdditionalWork);
        record.put("scheduledWorkingDay", scheduledWorkingDay);
        record.put("shiftSource", shiftWindow.shiftSource());
        record.put("expectedShiftStart", shiftWindow.expectedShiftStartText());
        record.put("expectedShiftEnd", shiftWindow.expectedShiftEndText());
        record.put("expectedMinutes", shiftWindow.expectedMinutes());
        record.put("workedMinutes", workedMinutes);
        record.put("lateMinutes", lateMinutes);
        record.put("earlyOutMinutes", earlyOutMinutes);
        record.put("payableMinutes", payableMinutes);
        record.put("calculatedMissedMinutes", calculatedMissedMinutes);
        record.put("missedTimes", calculatedMissedMinutes);
        return record;
    }

    private Map<String, Object> toRecordMap(AttendanceRecord source) {
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
        record.put("expectedShiftStart", source.getExpectedShiftStart());
        record.put("expectedShiftEnd", source.getExpectedShiftEnd());
        record.put("expectedMinutes", source.getExpectedMinutes());
        record.put("shiftSource", source.getShiftSource());

        Employee employeeSource = source.getEmployee();
        record.put("employeeId", employeeSource == null ? null : employeeSource.getId());
        record.put("employee", toEmployeeMap(employeeSource));
        return record;
    }

    private Map<String, Object> toEmployeeMap(Employee employeeSource) {
        Map<String, Object> employee = new LinkedHashMap<>();
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
            employee.put("shiftStart", employeeSource.getShiftStart());
            employee.put("shiftEnd", employeeSource.getShiftEnd());
            employee.put("leavePolicyType", employeeSource.getLeavePolicyType());
        }
        return employee;
    }

    private Map<String, Object> toAdditionalWorkingDayMap(EmployeeAdditionalWorkingDay day) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("dayType", day.getDayType() == null ? null : day.getDayType().name());
        item.put("timeIn", day.getTimeIn());
        item.put("timeOut", day.getTimeOut());
        return item;
    }

    private LocalDate resolveRecordDate(Map<String, Object> record) {
        LocalDate parsed = parseDate(text(record.get("date")));
        if (parsed != null) {
            return parsed;
        }
        LocalDateTime timeIn = parseDateTime(record.get("timeIn"), null);
        if (timeIn != null) {
            return timeIn.toLocalDate();
        }
        LocalDateTime timeOut = parseDateTime(record.get("timeOut"), null);
        return timeOut == null ? null : timeOut.toLocalDate();
    }

    @SuppressWarnings("unchecked")
    private Long resolveEmployeeId(Map<String, Object> record) {
        Object employeeId = record.get("employeeId");
        if (employeeId == null && record.get("employee") instanceof Map<?, ?> employee) {
            employeeId = ((Map<String, Object>) employee).get("id");
            if (employeeId == null) {
                employeeId = ((Map<String, Object>) employee).get("employeeId");
            }
        }
        return asLong(employeeId);
    }

    private int calculateWorkedMinutes(Map<String, Object> record, LocalDateTime timeIn, LocalDateTime timeOut) {
        int workedHoursMinutes = (int) Math.round(Math.max(0.0, decimal(record.get("workedHours"))) * 60.0);
        if (workedHoursMinutes > 0) {
            return workedHoursMinutes;
        }
        if (timeIn == null || timeOut == null || !timeOut.isAfter(timeIn)) {
            return 0;
        }
        return (int) Duration.between(timeIn, timeOut).toMinutes();
    }

    private int calculateLateMinutes(ShiftResolverService.ShiftResolution window, LocalDateTime timeIn) {
        if (window.expectedMinutes() <= 0
                || window.expectedShiftStart() == null
                || timeIn == null
                || !timeIn.toLocalTime().isAfter(window.expectedShiftStart())) {
            return 0;
        }
        return (int) Duration.between(window.expectedShiftStart(), timeIn.toLocalTime()).toMinutes();
    }

    private int calculateEarlyOutMinutes(ShiftResolverService.ShiftResolution window, LocalDateTime timeOut) {
        if (window.expectedMinutes() <= 0
                || window.expectedShiftEnd() == null
                || timeOut == null
                || !timeOut.toLocalTime().isBefore(window.expectedShiftEnd())) {
            return 0;
        }
        return (int) Duration.between(timeOut.toLocalTime(), window.expectedShiftEnd()).toMinutes();
    }

    private int calculatePayableMinutes(String countStatus, int workedMinutes, int lateMinutes) {
        if (!"Present".equalsIgnoreCase(text(countStatus))) {
            return 0;
        }
        return Math.max(0, Math.max(0, workedMinutes) - Math.max(0, lateMinutes));
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        for (DateTimeFormatter formatter : List.of(
                DATE_DD_MM_YYYY,
                DateTimeFormatter.ISO_LOCAL_DATE,
                DATE_DD_MM_YYYY_DASH)) {
            try {
                return LocalDate.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
                // Try next supported format.
            }
        }
        return null;
    }

    private LocalDateTime parseDateTime(Object value, LocalDate fallbackDate) {
        if (value instanceof LocalDateTime dateTime) {
            return dateTime;
        }
        String raw = text(value);
        if (raw.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(raw);
        } catch (DateTimeParseException ignored) {
            // Continue with time-only parsing.
        }
        Optional<LocalTime> time = parseTime(raw);
        if (time.isPresent() && fallbackDate != null) {
            return LocalDateTime.of(fallbackDate, time.get());
        }
        return null;
    }

    private Optional<LocalTime> parseTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String value = raw.trim();
        if (value.length() >= 16 && value.contains("T")) {
            try {
                return Optional.of(LocalDateTime.parse(value).toLocalTime());
            } catch (DateTimeParseException ignored) {
                // Try time-only formats.
            }
        }
        for (DateTimeFormatter formatter : List.of(TIME_HH_MM_SS, TIME_HH_MM)) {
            try {
                return Optional.of(LocalTime.parse(value, formatter));
            } catch (DateTimeParseException ignored) {
                // Try next supported format.
            }
        }
        return Optional.empty();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s_-]+", "");
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            String raw = text(value);
            return raw.isBlank() ? null : Long.parseLong(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            String raw = text(value);
            return raw.isBlank() ? 0 : Integer.parseInt(raw);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private double decimal(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            String raw = text(value);
            return raw.isBlank() ? 0.0 : Double.parseDouble(raw);
        } catch (NumberFormatException ignored) {
            return 0.0;
        }
    }

    private record BatchContext(
            Map<LocalDate, List<Holiday>> holidaysByDate,
            Map<Long, List<EmployeeAdditionalWorkingDay>> additionalWorkingDaysByEmployeeId) {
    }
}
