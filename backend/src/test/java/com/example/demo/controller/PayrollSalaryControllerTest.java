package com.example.demo.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.example.demo.MODELS.Employee;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.repo.EmployeeSalaryDetailsRepository;
import com.example.demo.service.PayrollCalculationService;
import com.example.demo.service.SchemaMaintenanceService;

class PayrollSalaryControllerTest {
    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final EmployeeSalaryDetailsRepository salaries = mock(EmployeeSalaryDetailsRepository.class);
    private final PayrollCalculationService payroll = mock(PayrollCalculationService.class);
    private MockMvc mvc;

    @BeforeEach void setup() {
        var controller = new EmployeeSalaryDetailsController();
        ReflectionTestUtils.setField(controller, "employeeRepository", employees);
        ReflectionTestUtils.setField(controller, "salaryDetailsRepository", salaries);
        ReflectionTestUtils.setField(controller, "payrollCalculationService", payroll);
        ReflectionTestUtils.setField(controller, "schemaMaintenanceService", mock(SchemaMaintenanceService.class));
        mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new GlobalExceptionHandler()).build();
        var employee = new Employee(); employee.setId(1L); employee.setClientId(1L);
        when(employees.findByIdAndClientId(1L, 1L)).thenReturn(Optional.of(employee));
        var result = mock(PayrollCalculationService.PayrollResult.class);
        when(result.estimatedNetSalary()).thenReturn(14950.0);
        when(result.basicSalary()).thenReturn(15000.0);
        when(result.overtimeAmount()).thenReturn(new BigDecimal("50.00"));
        when(payroll.calculateMonthlyPayroll(1L, 8, 2026, 1L)).thenReturn(result);
    }

    private MockHttpServletRequestBuilder preview() {
        return post("/api/salary-details/calculate").param("employeeId", "1").param("clientId", "1")
                .param("position", "QA").param("branch", "QA").param("month", "8").param("year", "2026")
                .param("preview", "true");
    }

    @Test void previewUsesBackendSalaryAndOvertimeInsteadOfClientAmounts() throws Exception {
        mvc.perform(preview().param("salary", "999999").param("overTime", "999999"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.salary").value(14950))
                .andExpect(jsonPath("$.overTime").value(50)).andExpect(jsonPath("$.netSalary").value(15000));
        verifyNoInteractions(salaries);
    }

    @Test void manualLopCannotDeductAttendanceShortageTwice() throws Exception {
        mvc.perform(preview().param("lossOfPay", "50")).andExpect(status().isBadRequest());
        verifyNoInteractions(salaries);
    }

    @Test void incompleteAttendanceReturnsReviewConflictAndDoesNotSave() throws Exception {
        when(payroll.calculateMonthlyPayroll(1L, 8, 2026, 1L))
                .thenThrow(new IllegalStateException("Payroll review required: incomplete attendance"));
        mvc.perform(preview()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Payroll review required: incomplete attendance"));
        verifyNoInteractions(salaries);
    }
}
