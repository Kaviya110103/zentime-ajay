package com.example.demo.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.example.demo.MODELS.Employee;
import com.example.demo.controller.EmployeeController;
import com.example.demo.repo.EmployeeNetPaymentRepository;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.service.AdditionalWorkingDayService;
import com.example.demo.service.EmailService;
import com.example.demo.service.EmployeeProfileImageStorageService;
import com.example.demo.service.EmployeeService;
import com.example.demo.service.PushNotificationService;
import com.example.demo.service.SchemaMaintenanceService;
import com.example.demo.tenant.TenantContext;

class EmployeeLoginControllerTest {

    private EmployeeController controller;
    private EmployeeRepository employeeRepository;
    private PushNotificationService pushNotificationService;
    private SchemaMaintenanceService schemaMaintenanceService;
    private JdbcTemplate masterJdbcTemplate;
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        employeeRepository = mock(EmployeeRepository.class);
        pushNotificationService = mock(PushNotificationService.class);
        schemaMaintenanceService = mock(SchemaMaintenanceService.class);
        masterJdbcTemplate = mock(JdbcTemplate.class);

        controller = new EmployeeController(
                passwordEncoder,
                mock(EmployeeService.class),
                mock(EmployeeNetPaymentRepository.class),
                employeeRepository,
                mock(AdditionalWorkingDayService.class),
                mock(DataSource.class),
                mock(EmailService.class),
                pushNotificationService,
                schemaMaintenanceService,
                mock(EmployeeProfileImageStorageService.class));

        ReflectionTestUtils.setField(controller, "masterJdbcTemplate", masterJdbcTemplate);
        TenantContext.clear();
    }

    @Test
    void validEmployeeLoginReturnsEmployeeContextWithoutExposingPassword() {
        Employee employee = employee(14L, 1L, "kaviya", passwordEncoder.encode("secret"), "iie");
        when(employeeRepository.findFirstByUsernameIgnoreCase("kaviya")).thenReturn(Optional.of(employee));

        ResponseEntity<Object> response = controller.loginEmployee(Map.of(
                "username", " kaviya ",
                "password", "secret",
                "companyCode", ""));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isInstanceOf(Employee.class);
        Employee body = (Employee) response.getBody();
        assertThat(body.getId()).isEqualTo(14L);
        assertThat(body.getClientId()).isEqualTo(1L);
        assertThat(body.getPassword()).as("Login responses must not expose password hashes").isNull();
        verify(pushNotificationService).notifyLogin(employee);
        assertThat(TenantContext.getTenantDb()).isNull();
    }

    @Test
    void wrongPasswordReturnsControlledFailureAndDoesNotNotify() {
        Employee employee = employee(14L, 1L, "kaviya", passwordEncoder.encode("secret"), "iie");
        when(employeeRepository.findFirstByUsernameIgnoreCase("kaviya")).thenReturn(Optional.of(employee));

        ResponseEntity<Object> response = controller.loginEmployee(Map.of(
                "username", "kaviya",
                "password", "wrong",
                "companyCode", ""));

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).isEqualTo(Map.of("error", "Invalid username or password"));
        verify(pushNotificationService, never()).notifyLogin(any());
        assertThat(TenantContext.getTenantDb()).isNull();
    }

    @Test
    void unknownEmployeeReturnsControlledFailure() {
        when(employeeRepository.findFirstByUsernameIgnoreCase("missing")).thenReturn(Optional.empty());

        ResponseEntity<Object> response = controller.loginEmployee(Map.of(
                "username", "missing",
                "password", "secret",
                "companyCode", ""));

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        assertThat(response.getBody()).isEqualTo(Map.of("error", "Invalid username or password"));
        assertThat(TenantContext.getTenantDb()).isNull();
    }

    @Test
    void legacyPlainPasswordLoginStillWorksAndUpgradesHash() {
        Employee employee = employee(14L, 1L, "legacy", "plain123", "iie");
        when(employeeRepository.findFirstByUsernameIgnoreCase("legacy")).thenReturn(Optional.of(employee));
        when(employeeRepository.save(any(Employee.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<Object> response = controller.loginEmployee(Map.of(
                "username", "legacy",
                "password", "plain123",
                "companyCode", ""));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(passwordEncoder.matches("plain123", employee.getPassword())).isTrue();
        verify(employeeRepository).save(employee);
        assertThat(TenantContext.getTenantDb()).isNull();
    }

    @Test
    void employeeFromAnotherTenantMustNotAuthenticateViaMasterFallback() {
        Employee masterEmployee = employee(14L, 1L, "kaviya", passwordEncoder.encode("secret"), "iie");
        when(masterJdbcTemplate.query(anyString(), ArgumentMatchers.<org.springframework.jdbc.core.RowMapper<String>>any(), eq("otherco")))
                .thenReturn(List.of("tenant_otherco"));
        when(employeeRepository.findFirstByUsernameIgnoreCase("kaviya"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(masterEmployee));

        ResponseEntity<Object> response = controller.loginEmployee(Map.of(
                "username", "kaviya",
                "password", "secret",
                "companyCode", "otherco"));

        assertThat(response.getStatusCode().value()).isEqualTo(401);
        verify(pushNotificationService, never()).notifyLogin(any());
        assertThat(TenantContext.getTenantDb()).isNull();
    }

    private Employee employee(Long id, Long clientId, String username, String password, String companyCode) {
        Employee employee = new Employee();
        employee.setId(id);
        employee.setClientId(clientId);
        employee.setUsername(username);
        employee.setPassword(password);
        employee.setCompanyCode(companyCode);
        employee.setFirstName("Test");
        employee.setLastName("Employee");
        employee.setEmail(username + "@example.com");
        employee.setBranch("Main");
        employee.setShiftStartTime("09:00");
        employee.setShiftEndTime("18:00");
        return employee;
    }
}
