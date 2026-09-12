package com.example.demo.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.matchesPattern;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.demo.tenant.TenantContext;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class BackendMySqlIntegrationTest {

    private static final DateTimeFormatter DB_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final String TENANT_A = "zentime_it_tenant_a";
    private static final String TENANT_B = "zentime_it_tenant_b";

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0.36")
            .withDatabaseName("zentime_it_master")
            .withUsername("root")
            .withPassword("zentime_test");

    @DynamicPropertySource
    static void testDatabaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("spring.flyway.enabled", () -> "false");
        registry.add("app.flyway.enabled", () -> "false");
        registry.add("tenant.routing.enabled", () -> "true");
        registry.add("push.enabled", () -> "false");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        createTenantDatabase(TENANT_A);
        createTenantDatabase(TENANT_B);
        truncateTenant(TENANT_A);
        truncateTenant(TENANT_B);
        jdbcTemplate.update("DELETE FROM clients");

        insertClient(1L, "iie", TENANT_A);
        insertClient(2L, "otherco", TENANT_B);
        insertEmployee(TENANT_A, 101L, 1L, "tenant-a-user", "Main", "A101");
        insertEmployee(TENANT_B, 201L, 2L, "tenant-b-user", "Branch B", "B201");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void validClientRoutesToCorrectTenant() throws Exception {
        insertAttendance(TENANT_A, 1001L, 101L, "15/09/2026", "Present", LocalDateTime.of(2026, 9, 15, 9, 0), null);

        MvcResult result = mockMvc.perform(get("/api/attendance-records/search")
                        .param("clientId", "1")
                        .param("employeeId", "101")
                        .param("limit", "5000"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("tenant-a-user");
        assertThat(body).doesNotContain("tenant-b-user");
    }

    @Test
    void requestWithoutCorrelationIdReceivesGeneratedCorrelationHeader() throws Exception {
        mockMvc.perform(get("/api/attendance-records/search")
                        .param("clientId", "1")
                        .param("limit", "5000"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Correlation-ID",
                        matchesPattern("[A-Za-z0-9._-]{1,128}")));
    }

    @Test
    void suppliedSafeCorrelationIdIsReturnedInResponseHeader() throws Exception {
        mockMvc.perform(get("/api/attendance-records/search")
                        .header("X-Correlation-ID", "qa-correlation-123")
                        .param("clientId", "1")
                        .param("limit", "5000"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Correlation-ID", "qa-correlation-123"));
    }

    @Test
    void correlationHeaderIsReturnedForControlledErrorResponse() throws Exception {
        mockMvc.perform(multipart("/api/attendance/mark-time-out")
                        .file(photo("imageOut"))
                        .header("X-Correlation-ID", "qa-error-correlation")
                        .param("clientId", "1")
                        .param("recordId", "999999"))
                .andExpect(status().isNotFound())
                .andExpect(header().string("X-Correlation-ID", "qa-error-correlation"));
    }

    @Test
    void invalidClientDoesNotResolveAnotherTenant() throws Exception {
        insertAttendance(TENANT_A, 1002L, 101L, "15/09/2026", "Present", LocalDateTime.of(2026, 9, 15, 9, 0), null);

        MvcResult result = mockMvc.perform(get("/api/attendance-records/search")
                        .param("clientId", "999")
                        .param("employeeId", "101")
                        .param("limit", "5000"))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).isEqualTo("[]");
    }

    @Test
    void tenantContextIsClearedAfterRequest() throws Exception {
        mockMvc.perform(get("/api/attendance-records/search")
                        .param("clientId", "1")
                        .param("limit", "5000"))
                .andExpect(status().isOk());

        assertThat(TenantContext.getTenantDb()).isNull();
    }

    @Test
    void employeeFromTenantACannotAccessTenantBData() throws Exception {
        insertAttendance(TENANT_A, 1003L, 101L, "15/09/2026", "Present", LocalDateTime.of(2026, 9, 15, 9, 0), null);

        MvcResult result = mockMvc.perform(get("/api/attendance-records/search")
                        .param("clientId", "2")
                        .param("employeeId", "101")
                        .param("limit", "5000"))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).isEqualTo("[]");
    }

    @Test
    void timeInUpdatesOnlyOneAttendanceRow() throws Exception {
        String today = LocalDate.now().format(DB_DATE);

        mockMvc.perform(put("/api/attendance/start-day")
                        .param("clientId", "1")
                        .param("employeeId", "101")
                        .param("location", "Office"))
                .andExpect(status().isOk());

        Long recordId = attendanceRecordId(TENANT_A, 101L, today);
        mockMvc.perform(multipart("/api/attendance/mark-time-in")
                        .file(photo("imageIn"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andExpect(status().isOk());

        assertThat(countAttendanceRows(TENANT_A, 101L, today)).isEqualTo(1);
        assertThat(timeInValue(TENANT_A, recordId)).isNotNull();
    }

    @Test
    void duplicateTimeInDoesNotCreateDuplicateRows() throws Exception {
        String today = LocalDate.now().format(DB_DATE);
        Long recordId = insertAttendance(TENANT_A, 1004L, 101L, today, "Present", null, null);

        mockMvc.perform(multipart("/api/attendance/mark-time-in")
                        .file(photo("imageIn"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andExpect(status().isOk());

        mockMvc.perform(multipart("/api/attendance/mark-time-in")
                        .file(photo("imageIn"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andExpect(status().isConflict());

        assertThat(countAttendanceRows(TENANT_A, 101L, today)).isEqualTo(1);
    }

    @Test
    void timeOutUpdatesExistingRecord() throws Exception {
        String today = LocalDate.now().format(DB_DATE);
        Long recordId = insertAttendance(
                TENANT_A,
                1005L,
                101L,
                today,
                "Present",
                LocalDateTime.now().minusHours(8),
                null);

        mockMvc.perform(multipart("/api/attendance/mark-time-out")
                        .file(photo("imageOut"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andExpect(status().isOk());

        assertThat(countAttendanceRows(TENANT_A, 101L, today)).isEqualTo(1);
        assertThat(timeOutValue(TENANT_A, recordId)).isNotNull();
    }

    @Test
    void timeOutWithoutTimeInDoesNotMutateDb() throws Exception {
        String today = LocalDate.now().format(DB_DATE);
        Long recordId = insertAttendance(TENANT_A, 1006L, 101L, today, "Present", null, null);

        mockMvc.perform(multipart("/api/attendance/mark-time-out")
                        .file(photo("imageOut"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andExpect(status().isBadRequest());

        assertThat(timeOutValue(TENANT_A, recordId)).isNull();
    }

    @Test
    void duplicateTimeOutIsRejected() throws Exception {
        String today = LocalDate.now().format(DB_DATE);
        LocalDateTime originalTimeOut = LocalDateTime.of(2026, 9, 15, 18, 0);
        Long recordId = insertAttendance(
                TENANT_A,
                1007L,
                101L,
                today,
                "Present",
                LocalDateTime.of(2026, 9, 15, 9, 0),
                originalTimeOut);

        mockMvc.perform(multipart("/api/attendance/mark-time-out")
                        .file(photo("imageOut"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andExpect(status().isConflict());

        assertThat(timeOutValue(TENANT_A, recordId)).isEqualTo(originalTimeOut);
    }

    @Test
    void employeeAttendanceRecordsRemainIsolatedBetweenTenants() throws Exception {
        insertAttendance(TENANT_A, 1008L, 101L, "15/09/2026", "Present", LocalDateTime.of(2026, 9, 15, 9, 0), null);
        insertAttendance(TENANT_B, 2008L, 201L, "15/09/2026", "Absent", null, null);

        MvcResult tenantA = mockMvc.perform(get("/api/attendance-records/search")
                        .param("clientId", "1")
                        .param("limit", "5000"))
                .andExpect(status().isOk())
                .andReturn();
        MvcResult tenantB = mockMvc.perform(get("/api/attendance-records/search")
                        .param("clientId", "2")
                        .param("limit", "5000"))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(tenantA.getResponse().getContentAsString()).contains("tenant-a-user").doesNotContain("tenant-b-user");
        assertThat(tenantB.getResponse().getContentAsString()).contains("tenant-b-user").doesNotContain("tenant-a-user");
    }

    @Test
    void concurrentTimeInRequestsLeaveOneAttendanceRow() throws Exception {
        String today = LocalDate.now().format(DB_DATE);
        Long recordId = insertAttendance(TENANT_A, 1009L, 101L, today, "Present", null, null);

        List<Integer> statuses = runConcurrently(2, () -> mockMvc.perform(multipart("/api/attendance/mark-time-in")
                        .file(photo("imageIn"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andReturn()
                .getResponse()
                .getStatus());

        assertThat(statuses).allMatch(status -> status == 200 || status == 409);
        assertThat(countAttendanceRows(TENANT_A, 101L, today)).isEqualTo(1);
        assertThat(timeInValue(TENANT_A, recordId)).isNotNull();
    }

    @Test
    void repeatedTimeOutRequestsLeaveOneAttendanceRow() throws Exception {
        String today = LocalDate.now().format(DB_DATE);
        Long recordId = insertAttendance(
                TENANT_A,
                1010L,
                101L,
                today,
                "Present",
                LocalDateTime.now().minusHours(8),
                LocalDateTime.now().minusHours(1));

        List<Integer> statuses = runConcurrently(2, () -> mockMvc.perform(multipart("/api/attendance/mark-time-out")
                        .file(photo("imageOut"))
                        .param("clientId", "1")
                        .param("recordId", String.valueOf(recordId)))
                .andReturn()
                .getResponse()
                .getStatus());

        assertThat(statuses).allMatch(status -> status == 409);
        assertThat(countAttendanceRows(TENANT_A, 101L, today)).isEqualTo(1);
    }

    @Test
    void monthlyReportWithClientIdDoesNotLeakAcrossMonthBoundary() throws Exception {
        insertAttendance(TENANT_A, 1011L, 101L, "31/08/2026", "Present", LocalDateTime.of(2026, 8, 31, 9, 0), null);
        insertAttendance(TENANT_A, 1012L, 101L, "01/09/2026", "Present", LocalDateTime.of(2026, 9, 1, 9, 0), null);

        MvcResult result = mockMvc.perform(get("/api/attendance-records/by-employee-month")
                        .param("clientId", "1")
                        .param("employeeId", "101")
                        .param("month", "8")
                        .param("year", "2026"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("31/08/2026");
        assertThat(body).doesNotContain("01/09/2026");
    }

    private void createTenantDatabase(String tenantDb) {
        String masterDb = MYSQL.getDatabaseName();
        jdbcTemplate.execute("CREATE DATABASE IF NOT EXISTS `" + tenantDb + "`");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS `" + tenantDb + "`.employee LIKE `" + masterDb + "`.employee");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS `" + tenantDb + "`.attendance_record LIKE `" + masterDb + "`.attendance_record");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS `" + tenantDb + "`.holidays LIKE `" + masterDb + "`.holidays");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS `" + tenantDb + "`.employee_additional_working_day LIKE `" + masterDb + "`.employee_additional_working_day");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS `" + tenantDb + "`.leave_permission LIKE `" + masterDb + "`.leave_permission");
    }

    private void truncateTenant(String tenantDb) {
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS=0");
        jdbcTemplate.execute("TRUNCATE TABLE `" + tenantDb + "`.leave_permission");
        jdbcTemplate.execute("TRUNCATE TABLE `" + tenantDb + "`.employee_additional_working_day");
        jdbcTemplate.execute("TRUNCATE TABLE `" + tenantDb + "`.holidays");
        jdbcTemplate.execute("TRUNCATE TABLE `" + tenantDb + "`.attendance_record");
        jdbcTemplate.execute("TRUNCATE TABLE `" + tenantDb + "`.employee");
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS=1");
    }

    private void insertClient(Long id, String companyCode, String tenantDb) {
        jdbcTemplate.update("""
                INSERT INTO clients (
                    id, client_name, company_name, company_code, mobile_number, email_address,
                    address, pincode, city, state, country, employee_count, registered_date,
                    working_hours, username, password, tenant_db_name, provisioning_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id,
                "Client " + id,
                "Company " + id,
                companyCode,
                "9999999999",
                "client" + id + "@example.com",
                "Test address",
                "600001",
                "Chennai",
                "Tamil Nadu",
                "India",
                10,
                LocalDate.of(2026, 1, 1),
                "09:00-18:00",
                "client" + id,
                "secret",
                tenantDb,
                "ACTIVE");
    }

    private void insertEmployee(String tenantDb, Long id, Long clientId, String username, String branch, String employeeCode) {
        jdbcTemplate.update("""
                INSERT INTO `%s`.employee (
                    id, first_name, last_name, username, password, email_id, client_id,
                    branch, shift_start_time, shift_end_time, week_off, company_code, employee_code
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.formatted(tenantDb),
                id,
                username,
                "Employee",
                username,
                "secret",
                username + "@example.com",
                clientId,
                branch,
                "09:00",
                "18:00",
                "Sunday",
                clientId == 1L ? "iie" : "otherco",
                employeeCode);
    }

    private Long insertAttendance(
            String tenantDb,
            Long id,
            Long employeeId,
            String date,
            String status,
            LocalDateTime timeIn,
            LocalDateTime timeOut) {
        jdbcTemplate.update("""
                INSERT INTO `%s`.attendance_record (
                    id, employee_id, date, attendance_status, location, time_in, time_out
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """.formatted(tenantDb),
                id,
                employeeId,
                date,
                status,
                "Office",
                timeIn,
                timeOut);
        return id;
    }

    private Long attendanceRecordId(String tenantDb, Long employeeId, String date) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM `" + tenantDb + "`.attendance_record WHERE employee_id = ? AND date = ?",
                Long.class,
                employeeId,
                date);
    }

    private int countAttendanceRows(String tenantDb, Long employeeId, String date) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM `" + tenantDb + "`.attendance_record WHERE employee_id = ? AND date = ?",
                Integer.class,
                employeeId,
                date);
        return count == null ? 0 : count;
    }

    private LocalDateTime timeInValue(String tenantDb, Long recordId) {
        return jdbcTemplate.queryForObject(
                "SELECT time_in FROM `" + tenantDb + "`.attendance_record WHERE id = ?",
                LocalDateTime.class,
                recordId);
    }

    private LocalDateTime timeOutValue(String tenantDb, Long recordId) {
        return jdbcTemplate.queryForObject(
                "SELECT time_out FROM `" + tenantDb + "`.attendance_record WHERE id = ?",
                LocalDateTime.class,
                recordId);
    }

    private MockMultipartFile photo(String fieldName) {
        return new MockMultipartFile(fieldName, "attendance.jpg", "image/jpeg", new byte[] {1, 2, 3});
    }

    private List<Integer> runConcurrently(int workers, Callable<Integer> action) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> futures = new ArrayList<>();
        for (int i = 0; i < workers; i++) {
            futures.add(executor.submit(() -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return action.call();
            }));
        }
        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        start.countDown();

        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> future : futures) {
            statuses.add(future.get(10, TimeUnit.SECONDS));
        }
        executor.shutdown();
        assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        return statuses;
    }
}
