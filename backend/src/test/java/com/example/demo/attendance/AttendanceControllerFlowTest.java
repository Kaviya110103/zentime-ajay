package com.example.demo.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import com.example.demo.MODELS.AttendanceRecord;
import com.example.demo.MODELS.Employee;
import com.example.demo.controller.AttendanceController;
import com.example.demo.repo.AttendanceRecordRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.repo.LeavePermissionRepository;
import com.example.demo.repo.LocationRepository;
import com.example.demo.repo.OvertimeRequestRepository;
import com.example.demo.service.AdditionalWorkingDayService;
import com.example.demo.service.AttendanceClassificationService;
import com.example.demo.service.AttendanceMetricsService;
import com.example.demo.service.AttendanceSchedulerService;
import com.example.demo.service.AttendanceService;
import com.example.demo.service.EmployeeService;
import com.example.demo.service.RequestFilterService;
import com.example.demo.service.SchemaMaintenanceService;
import com.example.demo.service.ShiftResolverService;

class AttendanceControllerFlowTest {

    private static final DateTimeFormatter DB_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private AttendanceController controller;
    private EmployeeRepository employeeRepository;
    private AttendanceRecordRepository attendanceRecordRepository;
    private EmployeeService employeeService;
    private ShiftResolverService shiftResolverService;
    private OvertimeRequestRepository overtimeRequestRepository;

    @BeforeEach
    void setUp() {
        controller = new AttendanceController();
        employeeRepository = mock(EmployeeRepository.class);
        attendanceRecordRepository = mock(AttendanceRecordRepository.class);
        employeeService = mock(EmployeeService.class);
        shiftResolverService = mock(ShiftResolverService.class);
        overtimeRequestRepository = mock(OvertimeRequestRepository.class);

        ReflectionTestUtils.setField(controller, "employeeRepository", employeeRepository);
        ReflectionTestUtils.setField(controller, "employeeService", employeeService);
        ReflectionTestUtils.setField(controller, "leavePermissionRepository", mock(LeavePermissionRepository.class));
        ReflectionTestUtils.setField(controller, "attendanceMetricsService", mock(AttendanceMetricsService.class));
        ReflectionTestUtils.setField(controller, "attendanceClassificationService", mock(AttendanceClassificationService.class));
        ReflectionTestUtils.setField(controller, "additionalWorkingDayService", mock(AdditionalWorkingDayService.class));
        ReflectionTestUtils.setField(controller, "requestFilterService", mock(RequestFilterService.class));
        ReflectionTestUtils.setField(controller, "attendanceSchedulerService", mock(AttendanceSchedulerService.class));
        ReflectionTestUtils.setField(controller, "shiftResolverService", shiftResolverService);
        ReflectionTestUtils.setField(controller, "locationRepository", mock(LocationRepository.class));
        ReflectionTestUtils.setField(controller, "attendanceService", mock(AttendanceService.class));
        ReflectionTestUtils.setField(controller, "attendanceRecordRepository", attendanceRecordRepository);
        ReflectionTestUtils.setField(controller, "schemaMaintenanceService", mock(SchemaMaintenanceService.class));
        ReflectionTestUtils.setField(controller, "overtimeRequestRepository", overtimeRequestRepository);

        when(shiftResolverService.resolve(any(Employee.class), any(LocalDate.class), any()))
                .thenReturn(new ShiftResolverService.ShiftResolution(
                        LocalTime.of(9, 0),
                        LocalTime.of(18, 0),
                        540,
                        "EMPLOYEE",
                        true,
                        false,
                        false,
                        false));
    }

    @Test
    void startDayWithValidEmployeeCreatesAttendanceRecordForToday() {
        Employee employee = employee(14L, 1L);
        String today = LocalDate.now().format(DB_DATE);
        String yesterday = LocalDate.now().minusDays(1).format(DB_DATE);
        when(employeeRepository.findById(14L)).thenReturn(Optional.of(employee));
        when(attendanceRecordRepository.findByEmployeeIdAndDate(14L, yesterday)).thenReturn(List.of());
        when(attendanceRecordRepository.findByEmployeeIdAndDate(14L, today)).thenReturn(List.of());
        when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<?> response = controller.startDay(14L, "Office", 1L, null, null);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        verify(attendanceRecordRepository).save(any(AttendanceRecord.class));
    }

    @Test
    void startDayBlocksWhenPreviousDayPresentHasNoTimeOutOrReason() {
        Employee employee = employee(14L, 1L);
        String today = LocalDate.now().format(DB_DATE);
        String yesterday = LocalDate.now().minusDays(1).format(DB_DATE);
        AttendanceRecord yesterdayRecord = record(100L, employee, yesterday);
        yesterdayRecord.setAttendanceStatus("Present");
        yesterdayRecord.setTimeOut(null);
        yesterdayRecord.setTimoutReason(null);

        when(employeeRepository.findById(14L)).thenReturn(Optional.of(employee));
        when(attendanceRecordRepository.findByEmployeeIdAndDate(14L, yesterday)).thenReturn(List.of(yesterdayRecord));
        when(attendanceRecordRepository.findByEmployeeIdAndDate(14L, today)).thenReturn(List.of());

        ResponseEntity<?> response = controller.startDay(14L, "Office", 1L, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().toString()).contains("missedTimeoutRecordId");
        verify(attendanceRecordRepository, never()).save(any());
    }

    @Test
    void markTimeInRecordsTimeAndImageOnce() {
        Employee employee = employee(14L, 1L);
        AttendanceRecord record = record(3253L, employee, LocalDate.now().format(DB_DATE));
        when(attendanceRecordRepository.findById(3253L)).thenReturn(Optional.of(record));
        when(attendanceRecordRepository.save(record)).thenReturn(record);

        ResponseEntity<String> response = controller.markTimeIn(
                3253L,
                new MockMultipartFile("imageIn", "tiny.jpg", "image/jpeg", new byte[] {1, 2, 3}),
                1L);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(record.getTimeIn()).isNotNull();
        assertThat(record.getImageIn()).containsExactly(1, 2, 3);
        verify(attendanceRecordRepository).save(record);
    }

    @Test
    void duplicateTimeInReturnsConflictWithoutSavingAgain() {
        Employee employee = employee(14L, 1L);
        AttendanceRecord record = record(3253L, employee, LocalDate.now().format(DB_DATE));
        record.setTimeIn(LocalDateTime.now().minusHours(1));
        when(attendanceRecordRepository.findById(3253L)).thenReturn(Optional.of(record));

        ResponseEntity<String> response = controller.markTimeIn(
                3253L,
                new MockMultipartFile("imageIn", "tiny.jpg", "image/jpeg", new byte[] {1}),
                1L);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).contains("already recorded");
        verify(attendanceRecordRepository, never()).save(any());
    }

    @Test
    void markTimeOutUpdatesExistingRecordWithoutCreatingNewAttendanceRow() {
        Employee employee = employee(14L, 1L);
        AttendanceRecord record = record(3253L, employee, LocalDate.now().format(DB_DATE));
        record.setTimeIn(LocalDateTime.now().minusHours(8));
        when(attendanceRecordRepository.findById(3253L)).thenReturn(Optional.of(record));
        when(attendanceRecordRepository.save(record)).thenReturn(record);

        ResponseEntity<String> response = controller.markTimeOut(
                3253L,
                new MockMultipartFile("imageOut", "tiny.jpg", "image/jpeg", new byte[] {9}),
                false,
                false,
                null);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(record.getTimeOut()).isNotNull();
        assertThat(record.getImageOut()).containsExactly(9);
        verify(attendanceRecordRepository).save(record);
        verify(employeeRepository, never()).save(any());
    }

    @Test
    void markTimeOutWithoutValidTimeInMustReturnControlledFailureWithoutCorruptingRecord() {
        Employee employee = employee(14L, 1L);
        AttendanceRecord record = record(3253L, employee, LocalDate.now().format(DB_DATE));
        record.setTimeIn(null);
        when(attendanceRecordRepository.findById(3253L)).thenReturn(Optional.of(record));

        ResponseEntity<String> response = controller.markTimeOut(
                3253L,
                new MockMultipartFile("imageOut", "tiny.jpg", "image/jpeg", new byte[] {9}),
                false,
                false,
                null);

        assertThat(response.getStatusCode().is4xxClientError()).isTrue();
        assertThat(record.getTimeOut()).isNull();
        verify(attendanceRecordRepository, never()).save(any());
    }

    @Test
    void markTimeInRejectsInvalidClientIdWithoutChangingRecord() {
        Employee employee = employee(14L, 1L);
        AttendanceRecord record = record(3253L, employee, LocalDate.now().format(DB_DATE));
        when(attendanceRecordRepository.findById(3253L)).thenReturn(Optional.of(record));

        ResponseEntity<String> response = controller.markTimeIn(
                3253L,
                new MockMultipartFile("imageIn", "tiny.jpg", "image/jpeg", new byte[] {1}),
                2L);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(record.getTimeIn()).isNull();
        verify(attendanceRecordRepository, never()).save(any());
    }

    private Employee employee(Long id, Long clientId) {
        Employee employee = new Employee();
        employee.setId(id);
        employee.setClientId(clientId);
        employee.setUsername("employee" + id);
        employee.setFirstName("Test");
        employee.setLastName("Employee");
        employee.setBranch("Main");
        employee.setShiftStartTime("09:00");
        employee.setShiftEndTime("18:00");
        employee.setWeekOff("Sunday");
        return employee;
    }

    private AttendanceRecord record(Long id, Employee employee, String date) {
        AttendanceRecord record = new AttendanceRecord();
        record.setId(id);
        record.setEmployee(employee);
        record.setDate(date);
        record.setAttendanceStatus("Present");
        record.setLocation("Office");
        return record;
    }
}
