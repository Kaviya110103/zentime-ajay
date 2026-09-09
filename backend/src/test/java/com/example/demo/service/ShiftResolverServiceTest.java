package com.example.demo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.demo.MODELS.AdditionalWorkingDayType;
import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.EmployeeAdditionalWorkingDay;
import com.example.demo.MODELS.Holiday;
import com.example.demo.repo.HolidayRepository;

class ShiftResolverServiceTest {

    private final ShiftResolverService resolver = new ShiftResolverService(
            mock(AdditionalWorkingDayService.class),
            mock(HolidayRepository.class));

    @Test
    void evenSaturdayAdditionalWorkingMakesOddSaturdayWeekOffAndEvenSaturdayWorking() {
        Employee employee = employee();
        List<EmployeeAdditionalWorkingDay> additionalDays = List.of(additionalDay(
                AdditionalWorkingDayType.EVEN_SATURDAY,
                "10:00",
                "18:30"));

        ShiftResolverService.ShiftResolution oddSaturday = resolver.resolve(
                employee,
                LocalDate.of(2026, 9, 5),
                List.of(),
                additionalDays);
        ShiftResolverService.ShiftResolution evenSaturday = resolver.resolve(
                employee,
                LocalDate.of(2026, 9, 12),
                List.of(),
                additionalDays);

        assertThat(oddSaturday.weekOff()).isTrue();
        assertThat(oddSaturday.scheduledWorkingDay()).isFalse();
        assertThat(evenSaturday.additionalWorkingDay()).isTrue();
        assertThat(evenSaturday.scheduledWorkingDay()).isTrue();
        assertThat(evenSaturday.shiftSource()).isEqualTo("ADDITIONAL_WORKING_DAY");
    }

    @Test
    void oddSaturdayAdditionalWorkingMakesOddSaturdayWorkingAndEvenSaturdayWeekOff() {
        Employee employee = employee();
        List<EmployeeAdditionalWorkingDay> additionalDays = List.of(additionalDay(
                AdditionalWorkingDayType.ODD_SATURDAY,
                "10:00",
                "18:30"));

        ShiftResolverService.ShiftResolution oddSaturday = resolver.resolve(
                employee,
                LocalDate.of(2026, 9, 5),
                List.of(),
                additionalDays);
        ShiftResolverService.ShiftResolution evenSaturday = resolver.resolve(
                employee,
                LocalDate.of(2026, 9, 12),
                List.of(),
                additionalDays);

        assertThat(oddSaturday.additionalWorkingDay()).isTrue();
        assertThat(oddSaturday.scheduledWorkingDay()).isTrue();
        assertThat(evenSaturday.weekOff()).isTrue();
        assertThat(evenSaturday.scheduledWorkingDay()).isFalse();
    }

    @Test
    void holidayPrecedenceRemainsAboveAdditionalWorkingDay() {
        Employee employee = employee();
        Holiday holiday = new Holiday();
        holiday.setHolidayDate(LocalDate.of(2026, 9, 12));
        List<EmployeeAdditionalWorkingDay> additionalDays = List.of(additionalDay(
                AdditionalWorkingDayType.EVEN_SATURDAY,
                "10:00",
                "18:30"));

        ShiftResolverService.ShiftResolution result = resolver.resolve(
                employee,
                LocalDate.of(2026, 9, 12),
                List.of(holiday),
                additionalDays);

        assertThat(result.holiday()).isTrue();
        assertThat(result.additionalWorkingDay()).isTrue();
        assertThat(result.scheduledWorkingDay()).isFalse();
        assertThat(result.shiftSource()).isEqualTo("HOLIDAY");
    }

    private Employee employee() {
        Employee employee = new Employee();
        employee.setId(1L);
        employee.setWeekOff("Sunday");
        employee.setLeavePolicyType("WEEKOFF");
        employee.setShiftStartTime("10:00");
        employee.setShiftEndTime("18:30");
        return employee;
    }

    private EmployeeAdditionalWorkingDay additionalDay(
            AdditionalWorkingDayType dayType,
            String timeIn,
            String timeOut) {
        EmployeeAdditionalWorkingDay day = new EmployeeAdditionalWorkingDay();
        day.setDayType(dayType);
        day.setTimeIn(timeIn);
        day.setTimeOut(timeOut);
        return day;
    }
}
