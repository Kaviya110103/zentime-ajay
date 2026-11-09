package com.example.demo.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.*;
import org.junit.jupiter.api.Test;

class AttendanceMinuteCalculatorTest {
    private final LocalDate day = LocalDate.of(2026, 8, 3);
    private ShiftResolverService.ShiftResolution shift(String start, String end, int minutes) {
        return new ShiftResolverService.ShiftResolution(LocalTime.parse(start), LocalTime.parse(end), minutes,
                "REGULAR", true, false, false, false);
    }
    @Test void lateAndEarlyAreCountedOnceAndNoLunchIsDeducted() {
        var value = AttendanceMinuteCalculator.calculate(day, shift("10:00", "19:00", 540),
                day.atTime(10, 22, 30), day.atTime(16, 25, 33));
        assertThat(value.worked()).isEqualTo(363);
        assertThat(value.late()).isEqualTo(22);
        assertThat(value.early()).isEqualTo(155);
        assertThat(value.missed()).isEqualTo(177);
        assertThat(value.worked() + value.missed()).isEqualTo(540);
    }
    @Test void shorterSundayShiftUsesItsOwnWindow() {
        var value = AttendanceMinuteCalculator.calculate(day, shift("10:00", "16:30", 390),
                day.atTime(10, 22), day.atTime(16, 25));
        assertThat(value.missed()).isEqualTo(27);
    }
    @Test void overtimeDoesNotOffsetLateArrival() {
        var value = AttendanceMinuteCalculator.calculate(day, shift("10:00", "19:00", 540),
                day.atTime(10, 30), day.atTime(19, 30));
        assertThat(value.worked()).isEqualTo(510);
        assertThat(value.missed()).isEqualTo(30);
        assertThat(value.overtime()).isEqualTo(30);
    }
    @Test void incompletePunchRequiresReview() {
        var value = AttendanceMinuteCalculator.calculate(day, shift("10:00", "19:00", 540), day.atTime(10, 0), null);
        assertThat(value.reviewReason()).isNotNull();
        assertThat(value.missed()).isNull();
    }
    @Test void nightShiftCrossesMonthBoundary() {
        var date = LocalDate.of(2026, 8, 31);
        var value = AttendanceMinuteCalculator.calculate(date, shift("22:00", "06:00", 480),
                date.atTime(22, 15), date.plusDays(1).atTime(5, 45));
        assertThat(value.worked()).isEqualTo(450);
        assertThat(value.missed()).isEqualTo(30);
    }
    @Test void punchesOutsideShiftCannotGenerateNegativeOrExcessMissedMinutes() {
        var value = AttendanceMinuteCalculator.calculate(day, shift("10:00", "19:00", 540),
                day.atTime(20, 0), day.atTime(21, 0));
        assertThat(value.worked()).isZero();
        assertThat(value.missed()).isEqualTo(540);
        assertThat(value.overtime()).isEqualTo(60);
    }
}
