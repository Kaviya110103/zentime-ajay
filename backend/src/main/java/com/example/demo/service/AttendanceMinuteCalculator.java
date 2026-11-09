package com.example.demo.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Minute-boundary arithmetic shared by attendance responses and payroll. No break deduction. */
public final class AttendanceMinuteCalculator {
    private AttendanceMinuteCalculator() {}

    public static Minutes calculate(LocalDate date, ShiftResolverService.ShiftResolution shift,
            LocalDateTime in, LocalDateTime out) {
        boolean punch = in != null || out != null;
        boolean incomplete = punch && (in == null || out == null || !out.isAfter(in));
        boolean missingShift = "FALLBACK".equals(shift.shiftSource());
        String reason = missingShift ? "Missing or invalid shift" : incomplete ? "Incomplete or invalid punches" : null;
        int expected = Math.max(0, shift.expectedMinutes());
        if (missingShift) return new Minutes(0, 0, 0, null, 0, reason);
        if (incomplete) {
            int knownLate = date != null && in != null && shift.expectedShiftStart() != null
                    ? Math.min(expected, between(date.atTime(shift.expectedShiftStart()), minute(in))) : 0;
            return new Minutes(0, knownLate, 0, null, 0, reason);
        }
        if (!punch) return new Minutes(0, 0, 0, expected, 0, null);
        LocalDateTime startIn = minute(in);
        LocalDateTime endOut = minute(out);
        if (expected == 0 || shift.expectedShiftStart() == null || shift.expectedShiftEnd() == null) {
            return new Minutes(0, 0, 0, 0, between(startIn, endOut), null);
        }
        if (date == null) return new Minutes(0, 0, 0, null, 0, "Invalid attendance date");
        LocalDateTime start = date.atTime(shift.expectedShiftStart());
        LocalDateTime end = date.atTime(shift.expectedShiftEnd());
        if (!end.isAfter(start)) end = end.plusDays(1);
        int late = between(start, min(max(startIn, start), end));
        int early = between(max(min(endOut, end), start), end);
        int worked = Math.min(expected, between(max(startIn, start), min(endOut, end)));
        int ot = between(max(startIn, end), endOut);
        return new Minutes(worked, late, early, Math.max(0, expected - worked), ot, null);
    }

    public static LocalDateTime minute(LocalDateTime value) {
        return value.withSecond(0).withNano(0);
    }

    public static int between(LocalDateTime start, LocalDateTime end) {
        return end.isAfter(start) ? Math.toIntExact(Duration.between(start, end).toMinutes()) : 0;
    }

    public static LocalDateTime min(LocalDateTime a, LocalDateTime b) { return a.isBefore(b) ? a : b; }
    public static LocalDateTime max(LocalDateTime a, LocalDateTime b) { return a.isAfter(b) ? a : b; }

    public record Minutes(int worked, int late, int early, Integer missed, int overtime, String reviewReason) {}
}
