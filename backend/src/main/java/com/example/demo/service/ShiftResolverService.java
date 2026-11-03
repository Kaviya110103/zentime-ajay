package com.example.demo.service;

import com.example.demo.MODELS.AdditionalWorkingDayType;
import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.EmployeeAdditionalWorkingDay;
import com.example.demo.MODELS.Holiday;
import com.example.demo.repo.HolidayRepository;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class ShiftResolverService {
    public static final LocalTime DEFAULT_SHIFT_START = LocalTime.of(9, 0);
    public static final LocalTime DEFAULT_SHIFT_END = LocalTime.of(18, 0);

    private static final DateTimeFormatter TIME_HH_MM = DateTimeFormatter.ofPattern("H:mm");
    private static final DateTimeFormatter TIME_HH_MM_SS = DateTimeFormatter.ofPattern("H:mm:ss");

    private final AdditionalWorkingDayService additionalWorkingDayService;
    private final HolidayRepository holidayRepository;

    public ShiftResolverService(
            AdditionalWorkingDayService additionalWorkingDayService,
            HolidayRepository holidayRepository) {
        this.additionalWorkingDayService = additionalWorkingDayService;
        this.holidayRepository = holidayRepository;
    }

    public ShiftResolution resolve(Employee employee, LocalDate date, Long clientId) {
        List<Holiday> holidays = List.of();
        Long effectiveClientId = clientId != null ? clientId : employee == null ? null : employee.getClientId();
        if (effectiveClientId != null && date != null) {
            holidays = holidayRepository.findByClientIdAndHolidayDateBetweenOrderByHolidayDateAsc(
                    effectiveClientId,
                    date,
                    date);
        }
        List<EmployeeAdditionalWorkingDay> additionalRows =
                employee == null || employee.getId() == null
                        ? List.of()
                        : additionalWorkingDayService.findUniqueEntities(employee.getId());
        return resolve(employee, date, holidays, additionalRows);
    }

    public ShiftResolution resolve(
            Employee employee,
            LocalDate date,
            List<Holiday> holidays,
            List<EmployeeAdditionalWorkingDay> additionalRows) {
        return resolve(
                employee == null ? null : employee.getBranch(),
                employee == null ? null : employee.getWeekOff(),
                employee == null ? null : employee.getLeavePolicyType(),
                employee == null ? null : employee.getShiftStartTime(),
                employee == null ? null : employee.getShiftEndTime(),
                employee == null ? null : employee.getShiftStart(),
                employee == null ? null : employee.getShiftEnd(),
                date,
                holidays,
                additionalRows);
    }

    public ShiftResolution resolve(
            Map<String, Object> employee,
            LocalDate date,
            List<Holiday> holidays,
            List<EmployeeAdditionalWorkingDay> additionalRows) {
        return resolve(
                text(employee == null ? null : employee.get("branch")),
                text(employee == null ? null : employee.get("weekOff")),
                text(employee == null ? null : employee.get("leavePolicyType")),
                text(employee == null ? null : employee.get("shiftStartTime")),
                text(employee == null ? null : employee.get("shiftEndTime")),
                text(employee == null ? null : employee.get("shiftStart")),
                text(employee == null ? null : employee.get("shiftEnd")),
                date,
                holidays,
                additionalRows);
    }

    public ShiftResolution resolveWithSnapshot(
            Map<String, Object> record,
            Map<String, Object> employee,
            LocalDate date,
            List<Holiday> holidays,
            List<EmployeeAdditionalWorkingDay> additionalRows) {
        ShiftResolution current = resolve(employee, date, holidays, additionalRows);
        Optional<LocalTime> snapshotStart = parseFlexibleTime(text(record == null ? null : record.get("expectedShiftStart")));
        Optional<LocalTime> snapshotEnd = parseFlexibleTime(text(record == null ? null : record.get("expectedShiftEnd")));
        Integer snapshotMinutes = asInteger(record == null ? null : record.get("expectedMinutes"));
        String snapshotSource = text(record == null ? null : record.get("shiftSource"));
        if (snapshotStart.isPresent()
                && snapshotEnd.isPresent()
                && !snapshotEnd.get().equals(snapshotStart.get())
                && !snapshotSource.isBlank()) {
            int minutes = snapshotMinutes == null || snapshotMinutes < 0
                    ? minutesBetween(snapshotStart.get(), snapshotEnd.get())
                    : snapshotMinutes;
            boolean scheduled = minutes > 0
                    && ("REGULAR".equalsIgnoreCase(snapshotSource)
                    || "ADDITIONAL_WORKING_DAY".equalsIgnoreCase(snapshotSource)
                    || "FALLBACK".equalsIgnoreCase(snapshotSource));
            return new ShiftResolution(
                    snapshotStart.get(),
                    snapshotEnd.get(),
                    minutes,
                    snapshotSource,
                    scheduled,
                    current.additionalWorkingDay(),
                    current.weekOff(),
                    current.holiday());
        }
        return current;
    }

    private ShiftResolution resolve(
            String branch,
            String weekOff,
            String leavePolicyType,
            String shiftStartTime,
            String shiftEndTime,
            String shiftStart,
            String shiftEnd,
            LocalDate date,
            List<Holiday> holidays,
            List<EmployeeAdditionalWorkingDay> additionalRows) {
        boolean holiday = isHolidayForBranch(date, branch, holidays);
        boolean policyWeekOff = isPolicyWeekOff(date, weekOff, leavePolicyType)
                || isRotationalWeekOff(date, additionalRows);
        EmployeeAdditionalWorkingDay additionalDay = resolveAdditionalWorkingDay(date, additionalRows);
        boolean additionalWorkingDay = additionalDay != null;
        boolean effectiveWeekOff = policyWeekOff && !additionalWorkingDay;

        if (holiday) {
            return empty("HOLIDAY", additionalWorkingDay, effectiveWeekOff, true);
        }

        if (additionalDay != null) {
            Optional<LocalTime> start = parseFlexibleTime(additionalDay.getTimeIn());
            Optional<LocalTime> end = parseFlexibleTime(additionalDay.getTimeOut());
            if (start.isPresent() && end.isPresent() && !end.get().equals(start.get())) {
                return of(start.get(), end.get(), "ADDITIONAL_WORKING_DAY", true, true, false, false);
            }
        }

        if (effectiveWeekOff) {
            return empty("WEEK_OFF", false, true, false);
        }

        Optional<LocalTime> start = parseFlexibleTime(shiftStartTime)
                .or(() -> parseFlexibleTime(shiftStart));
        Optional<LocalTime> end = parseFlexibleTime(shiftEndTime)
                .or(() -> parseFlexibleTime(shiftEnd));
        if (start.isPresent() && end.isPresent() && !end.get().equals(start.get())) {
            return of(start.get(), end.get(), "REGULAR", true, false, false, false);
        }
        return of(DEFAULT_SHIFT_START, DEFAULT_SHIFT_END, "FALLBACK", true, false, false, false);
    }

    public EmployeeAdditionalWorkingDay resolveAdditionalWorkingDay(
            LocalDate date,
            List<EmployeeAdditionalWorkingDay> rows) {
        if (date == null || rows == null || rows.isEmpty()) {
            return null;
        }
        AdditionalWorkingDayType type = additionalWorkingType(date);
        if (type == null) {
            return null;
        }
        Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> byType =
                new EnumMap<>(AdditionalWorkingDayType.class);
        for (EmployeeAdditionalWorkingDay row : rows) {
            if (row != null && row.getDayType() != null) {
                byType.putIfAbsent(row.getDayType(), row);
            }
        }
        return byType.get(type);
    }

    public AdditionalWorkingDayType additionalWorkingType(LocalDate date) {
        if (date == null) {
            return null;
        }
        DayOfWeek day = date.getDayOfWeek();
        if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY) {
            return null;
        }
        int occurrence = 0;
        for (LocalDate cursor = date.withDayOfMonth(1); !cursor.isAfter(date); cursor = cursor.plusDays(1)) {
            if (cursor.getDayOfWeek() == day) {
                occurrence++;
            }
        }
        boolean odd = occurrence % 2 == 1;
        if (day == DayOfWeek.SATURDAY) {
            return odd ? AdditionalWorkingDayType.ODD_SATURDAY : AdditionalWorkingDayType.EVEN_SATURDAY;
        }
        return odd ? AdditionalWorkingDayType.ODD_SUNDAY : AdditionalWorkingDayType.EVEN_SUNDAY;
    }

    private boolean isRotationalWeekOff(LocalDate date, List<EmployeeAdditionalWorkingDay> rows) {
        AdditionalWorkingDayType currentType = additionalWorkingType(date);
        if (currentType == null || rows == null || rows.isEmpty()) {
            return false;
        }
        DayOfWeek currentDay = dayOfWeek(currentType);
        boolean sameWeekendDayConfigured = false;
        for (EmployeeAdditionalWorkingDay row : rows) {
            AdditionalWorkingDayType configuredType = row == null ? null : row.getDayType();
            if (configuredType == null || dayOfWeek(configuredType) != currentDay) {
                continue;
            }
            sameWeekendDayConfigured = true;
            if (configuredType == currentType) {
                return false;
            }
        }
        return sameWeekendDayConfigured;
    }

    private DayOfWeek dayOfWeek(AdditionalWorkingDayType type) {
        if (type == AdditionalWorkingDayType.ODD_SATURDAY || type == AdditionalWorkingDayType.EVEN_SATURDAY) {
            return DayOfWeek.SATURDAY;
        }
        if (type == AdditionalWorkingDayType.ODD_SUNDAY || type == AdditionalWorkingDayType.EVEN_SUNDAY) {
            return DayOfWeek.SUNDAY;
        }
        return null;
    }

    public Optional<LocalTime> parseFlexibleTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String value = raw.trim();
        for (DateTimeFormatter formatter : List.of(TIME_HH_MM_SS, TIME_HH_MM)) {
            try {
                return Optional.of(LocalTime.parse(value, formatter));
            } catch (DateTimeParseException ignored) {
                // Try next supported format.
            }
        }
        return Optional.empty();
    }

    private boolean isHolidayForBranch(LocalDate date, String branch, List<Holiday> holidays) {
        if (date == null || holidays == null || holidays.isEmpty()) {
            return false;
        }
        String employeeBranch = text(branch).toLowerCase(Locale.ROOT);
        for (Holiday holiday : holidays) {
            if (holiday == null || !date.equals(holiday.getHolidayDate())) {
                continue;
            }
            String branchScope = text(holiday.getBranchScope());
            if (branchScope.isBlank()
                    || "ALL".equalsIgnoreCase(branchScope)
                    || "All Branches".equalsIgnoreCase(branchScope)) {
                return true;
            }
            if (!employeeBranch.isBlank() && employeeBranch.equals(branchScope.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private boolean isPolicyWeekOff(LocalDate date, String weekOffRaw, String leavePolicyRaw) {
        if (date == null) {
            return false;
        }
        DayOfWeek day = date.getDayOfWeek();
        String leavePolicy = normalize(leavePolicyRaw);
        String weekOff = normalize(weekOffRaw);
        if (leavePolicy.contains("weekend")
                || (leavePolicy.contains("saturday") && leavePolicy.contains("sunday"))
                || (weekOff.contains("saturday") && weekOff.contains("sunday"))) {
            return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
        }
        DayOfWeek configured = parseDayOfWeek(weekOffRaw);
        return configured != null && configured == day;
    }

    private DayOfWeek parseDayOfWeek(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() >= 3) {
            normalized = normalized.substring(0, 3);
        }
        return switch (normalized) {
            case "MON" -> DayOfWeek.MONDAY;
            case "TUE" -> DayOfWeek.TUESDAY;
            case "WED" -> DayOfWeek.WEDNESDAY;
            case "THU" -> DayOfWeek.THURSDAY;
            case "FRI" -> DayOfWeek.FRIDAY;
            case "SAT" -> DayOfWeek.SATURDAY;
            case "SUN" -> DayOfWeek.SUNDAY;
            default -> null;
        };
    }

    private ShiftResolution of(
            LocalTime start,
            LocalTime end,
            String source,
            boolean scheduledWorkingDay,
            boolean additionalWorkingDay,
            boolean weekOff,
            boolean holiday) {
        return new ShiftResolution(
                start,
                end,
                minutesBetween(start, end),
                source,
                scheduledWorkingDay,
                additionalWorkingDay,
                weekOff,
                holiday);
    }

    private ShiftResolution empty(String source, boolean additionalWorkingDay, boolean weekOff, boolean holiday) {
        return new ShiftResolution(null, null, 0, source, false, additionalWorkingDay, weekOff, holiday);
    }

    private int minutesBetween(LocalTime start, LocalTime end) {
        if (start == null || end == null || end.equals(start)) {
            return 0;
        }
        int minutes = (int) Duration.between(start, end).toMinutes();
        return minutes > 0 ? minutes : minutes + 24 * 60;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s_-]+", "");
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            String raw = text(value);
            return raw.isBlank() ? null : Integer.parseInt(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    public record ShiftResolution(
            LocalTime expectedShiftStart,
            LocalTime expectedShiftEnd,
            int expectedMinutes,
            String shiftSource,
            boolean scheduledWorkingDay,
            boolean additionalWorkingDay,
            boolean weekOff,
            boolean holiday) {
        public String expectedShiftStartText() {
            return expectedShiftStart == null ? null : expectedShiftStart.format(TIME_HH_MM);
        }

        public String expectedShiftEndText() {
            return expectedShiftEnd == null ? null : expectedShiftEnd.format(TIME_HH_MM);
        }
    }
}
