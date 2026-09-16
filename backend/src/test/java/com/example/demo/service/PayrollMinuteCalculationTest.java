package com.example.demo.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.example.demo.MODELS.*;
import com.example.demo.repo.*;

class PayrollMinuteCalculationTest {
    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final AttendanceRecordRepository attendance = mock(AttendanceRecordRepository.class);
    private final LeavePermissionRepository leaves = mock(LeavePermissionRepository.class);
    private final OvertimeRequestRepository overtime = mock(OvertimeRequestRepository.class);
    private final List<AttendanceRecord> records = new ArrayList<>();
    private final List<LeavePermission> approvals = new ArrayList<>();
    private Employee employee;
    private PayrollCalculationService service;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @BeforeEach void setup() {
        employee = new Employee(); employee.setId(1L); employee.setClientId(1L);
        employee.setFirstName("QA"); employee.setSalary(16740.0);
        employee.setShiftStartTime("10:00"); employee.setShiftEndTime("19:00");
        employee.setCasualLeaveBalance(1); employee.setPermissionHoursAllowed(1.0);
        var additional = mock(AdditionalWorkingDayService.class);
        var holidays = mock(HolidayRepository.class);
        var classifier = new AttendanceClassificationService(additional, holidays, new ShiftResolverService(additional, holidays));
        service = new PayrollCalculationService(employees, attendance, mock(AttendanceSupportRequestRepository.class),
                leaves, holidays, mock(LeavePolicyRepository.class), mock(SchemaMaintenanceService.class), overtime, classifier);
        when(employees.findById(1L)).thenReturn(Optional.of(employee));
        when(attendance.findByEmployeeId(1L)).thenReturn(records);
        when(leaves.findByEmployeeIdAndStatus(1L, "approved")).thenReturn(approvals);
        for (int d = 1; d <= 31; d++) {
            var record = new AttendanceRecord(); var date = LocalDate.of(2026, 8, d);
            record.setId((long) d); record.setEmployee(employee); record.setDate(date.format(DATE));
            record.setTimeIn(date.atTime(10, 0)); record.setTimeOut(date.atTime(19, 0));
            record.setAttendanceStatus("Present"); record.setWorkedHours(1.0); // Deliberately stale.
            records.add(record);
        }
    }
    private PayrollCalculationService.PayrollResult calculate() { return service.calculateMonthlyPayroll(1L, 8, 2026, 1L); }
    private LeavePermission approval(String type, int day) {
        var leave = new LeavePermission(); leave.setEmployee(employee); leave.setLeaveType(type);
        leave.setDate(LocalDate.of(2026, 8, day).format(DATE));
        leave.setStartDate(leave.getDate()); leave.setEndDate(leave.getDate()); leave.setStatus("approved");
        approvals.add(leave); return leave;
    }
    @Test void fullSchedulePaysBaseAndIgnoresStaleWorkedHoursAndUnusedClEntitlement() {
        var result = calculate();
        assertThat(result.scheduledWorkingMinutes()).isEqualTo(16740);
        assertThat(result.netSalary()).isEqualTo(16740);
        assertThat(result.payableWorkingMinutes()).isEqualTo(16740);
    }
    @Test void lateAndEarlyDeductOnce() {
        var first = records.get(0); first.setTimeIn(first.getTimeIn().plusMinutes(20)); first.setTimeOut(first.getTimeOut().minusMinutes(40));
        var result = calculate();
        assertThat(result.netSalary()).isEqualTo(16680);
        assertThat(result.lateAttendanceMinutes()).isEqualTo(20);
        assertThat(result.absentMinutes()).isEqualTo(60);
    }
    @Test void unpaidLeaveIsNotPaid() {
        records.remove(0); approval("Unpaid Leave", 1);
        assertThat(calculate().netSalary()).isEqualTo(16200);
    }
    @Test void paidLeaveCreditsOnlyTheDaysOwnShift() {
        records.remove(0); approval("Paid Leave", 1);
        assertThat(calculate().netSalary()).isEqualTo(16740);
    }
    @Test void overlappingPermissionIsUnionedAndMonthlyAllowanceIsCapped() {
        var first = records.get(0); first.setTimeIn(first.getTimeIn().plusHours(2));
        for (int i = 0; i < 2; i++) { var leave = approval("Permission", 1); leave.setStartTime("10:00"); leave.setEndTime("12:00"); }
        var result = calculate();
        assertThat(result.permissionDurationMinutes()).isEqualTo(60);
        assertThat(result.netSalary()).isEqualTo(16680);
    }
    @Test void permissionWhileAlreadyWorkingDoesNotCreditAnotherAbsence() {
        records.remove(1); var leave = approval("Permission", 1); leave.setStartTime("10:00"); leave.setEndTime("11:00");
        assertThat(calculate().netSalary()).isEqualTo(16200);
    }
    @Test void approvedPermissionWithoutAttendanceCreditsOnlyApprovedInterval() {
        records.remove(0);
        var leave = approval("Permission", 1); leave.setStartTime("10:00"); leave.setEndTime("11:00");
        var result = calculate();
        assertThat(result.permissionDurationMinutes()).isEqualTo(60);
        assertThat(result.netSalary()).isEqualTo(16260);
        assertThat(result.dailyRows().get(0).get("paidCreditMinutes")).isEqualTo(60);
        assertThat(result.dailyRows().get(0).get("unpaidMissingMinutes")).isEqualTo(480);
    }
    @Test void missingSalaryRequiresReviewInsteadOfZeroPayroll() {
        employee.setSalary(null);
        assertThatThrownBy(this::calculate).isInstanceOf(IllegalStateException.class).hasMessageContaining("missing salary");
    }
    @Test void midMonthJoiningUsesFullMonthRateAndEligibleScheduleOnly() {
        employee.setDateOfJoining("2026-08-16"); records.removeIf(r -> r.getTimeIn().getDayOfMonth() < 16);
        var result = calculate();
        assertThat(result.netSalary()).isEqualTo(8640);
        assertThat(result.proratedBasic()).isEqualByComparingTo("8640");
        assertThat(result.absentMinutes()).isZero();
    }
    @Test void incompleteAndDuplicateAttendanceRequireReview() {
        records.get(0).setTimeOut(null);
        assertThatThrownBy(this::calculate).isInstanceOf(IllegalStateException.class).hasMessageContaining("review required");
        records.get(0).setTimeOut(records.get(0).getTimeIn().plusHours(9)); records.add(records.get(0));
        assertThatThrownBy(this::calculate).isInstanceOf(IllegalStateException.class).hasMessageContaining("duplicate");
    }
    @Test void tenantMismatchCannotCalculatePayroll() {
        assertThatThrownBy(() -> service.calculateMonthlyPayroll(1L, 8, 2026, 2L)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void dailyCurrencyAmountsReconcileToMonthlyTotal() {
        employee.setSalary(15000.0);
        var result = calculate();
        BigDecimal total = result.dailyRows().stream().map(r -> (BigDecimal) r.get("dayEarnedAmount")).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(total).isEqualByComparingTo("15000");
    }
    @Test void overtimeIsCappedToApprovedMinutesAndNotIncludedTwiceInBasic() {
        records.get(0).setTimeOut(records.get(0).getTimeOut().plusHours(1));
        var request = new OvertimeRequest(); request.setDate("01/08/2026"); request.setOvertimeHours(0.5);
        when(overtime.findByEmployeeIdAndStatus(1L, OvertimeRequestStatus.APPROVED)).thenReturn(List.of(request));
        var result = calculate();
        assertThat(result.netSalary()).isEqualTo(16740);
        assertThat(result.overtimeAmount()).isEqualByComparingTo("30");
        assertThat(result.overtimeHours()).isEqualTo(0.5);
    }
    @Test void recordedShiftSnapshotOverridesCurrentEmployeeShiftInDailyAndMonthlyTotals() {
        var first = records.get(0); first.setExpectedShiftStart("10:00"); first.setExpectedShiftEnd("16:30");
        first.setExpectedMinutes(390); first.setShiftSource("ADDITIONAL_WORKING_DAY"); first.setTimeOut(first.getTimeOut().withHour(16).withMinute(30));
        var result = calculate();
        assertThat(result.scheduledWorkingMinutes()).isEqualTo(16590);
        assertThat(result.netSalary()).isEqualTo(16740);
        assertThat(result.dailyRows().get(0).get("calculatedMissedMinutes")).isEqualTo(0);
    }
}
