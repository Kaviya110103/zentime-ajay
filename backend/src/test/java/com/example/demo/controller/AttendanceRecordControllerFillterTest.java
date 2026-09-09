package com.example.demo.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import com.example.demo.MODELS.Employee;
import com.example.demo.repo.AttendanceRecordRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.service.AttendanceClassificationService;

class AttendanceRecordControllerFillterTest {

    private AttendanceRecordControllerFillter controller;
    private AttendanceRecordRepository attendanceRecordRepository;
    private EmployeeRepository employeeRepository;
    private AttendanceClassificationService attendanceClassificationService;

    @BeforeEach
    void setUp() {
        controller = new AttendanceRecordControllerFillter();
        attendanceRecordRepository = mock(AttendanceRecordRepository.class);
        employeeRepository = mock(EmployeeRepository.class);
        attendanceClassificationService = mock(AttendanceClassificationService.class);

        ReflectionTestUtils.setField(controller, "attendanceRecordRepository", attendanceRecordRepository);
        ReflectionTestUtils.setField(controller, "employeeRepository", employeeRepository);
        ReflectionTestUtils.setField(controller, "attendanceClassificationService", attendanceClassificationService);
    }

    @Test
    void searchAttendanceRecordsSortsImmutableClassificationResult() {
        when(attendanceRecordRepository.findAttendanceRecordRows(eq(1L), any(Pageable.class)))
                .thenReturn(List.of(attendanceRow(2L, "01/09/2026"), attendanceRow(1L, "02/09/2026")));
        when(attendanceClassificationService.classifyRecordMaps(any(), eq(1L)))
                .thenReturn(List.of(
                        classifiedRecord(2L, "01/09/2026"),
                        classifiedRecord(1L, "02/09/2026")));

        ResponseEntity<?> response = controller.searchAttendanceRecords(
                1L, null, null, null, null, null, null, null, null, 0, 5000);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        List<?> body = (List<?>) response.getBody();
        assertThat(body).hasSize(2);
        assertThat((String) ((Map<?, ?>) body.get(0)).get("date")).isEqualTo("02/09/2026");
        assertThat((String) ((Map<?, ?>) body.get(1)).get("date")).isEqualTo("01/09/2026");
    }

    @Test
    void searchAttendanceRecordsSortsImmutableEmployeeFilteredResult() {
        Employee employee = new Employee();
        employee.setId(10L);
        employee.setClientId(1L);
        when(employeeRepository.findById(10L)).thenReturn(Optional.of(employee));
        when(attendanceRecordRepository.findAttendanceRecordRowsByClientAndEmployeeForSearch(
                eq(1L), eq(10L), any(Pageable.class)))
                .thenReturn(List.<Object[]>of(attendanceRow(5L, "01/09/2026")));
        when(attendanceClassificationService.classifyRecordMaps(any(), eq(1L)))
                .thenReturn(List.of(classifiedRecord(5L, "01/09/2026")));

        ResponseEntity<?> response = controller.searchAttendanceRecords(
                1L, "10", null, null, null, null, null, null, null, 0, 5000);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat((List<?>) response.getBody()).hasSize(1);
    }

    @Test
    void searchAttendanceRecordsReturnsImmutableEmptyResultWithoutSortingFailure() {
        when(employeeRepository.findById(99999L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.searchAttendanceRecords(
                1L, "99999", null, null, null, null, null, null, null, 0, 5000);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat((List<?>) response.getBody()).isEmpty();
    }

    private Object[] attendanceRow(Long id, String date) {
        return new Object[] {
                id, LocalDateTime.now(), null, null, null, "Present", date,
                0, 8.0, 0.0, false, null,
                10L, "Test", "Employee", "Main", "EMP10", "Sunday",
                "09:00:00", "18:00:00", "MONTHLY",
                "09:00:00", "18:00:00", 540, "EMPLOYEE"
        };
    }

    private Map<String, Object> classifiedRecord(Long id, String date) {
        return Map.of(
                "id", id,
                "date", date,
                "displayStatus", "Present",
                "countStatus", "Present",
                "lateMinutes", 0);
    }
}
