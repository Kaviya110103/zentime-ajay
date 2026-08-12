package db.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

public class V1__employee_schema_safety_net extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();

        ensureEmployeeTableColumns(connection);
        ensureLeavePolicyTable(connection);
        ensureAdditionalWorkingDaysTable(connection);
        ensureEmployeeSalaryDetailsTableColumns(connection);
        ensureAttendanceRecordColumns(connection);
        ensureOvertimeRequestTable(connection);
        ensureAttendanceSupportRequestTable(connection);
        ensureHolidayTable(connection);
    }

    private void ensureEmployeeTableColumns(Connection connection) throws Exception {
        ensureColumn(connection, "employee", "shift_start", "VARCHAR(16) NULL");
        ensureColumn(connection, "employee", "shift_end", "VARCHAR(16) NULL");
        ensureColumn(connection, "employee", "shift_start_time", "VARCHAR(16) NULL");
        ensureColumn(connection, "employee", "shift_end_time", "VARCHAR(16) NULL");
        ensureColumn(connection, "employee", "leave_policy_type", "VARCHAR(32) NULL");
        ensureColumn(connection, "employee", "casual_leave_balance", "INT DEFAULT 0");
        ensureColumn(connection, "employee", "permission_allowance_per_month", "INT NULL");
        ensureColumn(connection, "employee", "permission_hours_allowed", "DOUBLE NULL");
        ensureColumn(connection, "employee", "additional_working_days", "TEXT NULL");
    }

    private void ensureLeavePolicyTable(Connection connection) throws Exception {
        if (tableExists(connection, "leave_policy")) {
            ensureColumn(connection, "leave_policy", "employee_id", "BIGINT NULL");
            ensureColumn(connection, "leave_policy", "casual_leave_allowed", "INT NULL");
            ensureColumn(connection, "leave_policy", "sick_leave_allowed", "INT NULL");
            ensureColumn(connection, "leave_policy", "earned_leave_allowed", "INT NULL");
            return;
        }
        execute(connection, """
                CREATE TABLE IF NOT EXISTS leave_policy (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    employee_id BIGINT NULL,
                    casual_leave_allowed INT NULL,
                    sick_leave_allowed INT NULL,
                    earned_leave_allowed INT NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_leave_policy_employee (employee_id),
                    CONSTRAINT fk_leave_policy_employee
                        FOREIGN KEY (employee_id) REFERENCES employee(id)
                        ON DELETE CASCADE
                )
                """);
    }

    private void ensureAdditionalWorkingDaysTable(Connection connection) throws Exception {
        if (tableExists(connection, "employee_additional_working_day")) {
            return;
        }
        execute(connection, """
                CREATE TABLE IF NOT EXISTS employee_additional_working_day (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    employee_id BIGINT NOT NULL,
                    day_type VARCHAR(32) NOT NULL,
                    time_in VARCHAR(16) NULL,
                    time_out VARCHAR(16) NULL,
                    PRIMARY KEY (id),
                    KEY idx_employee_additional_day_employee (employee_id),
                    CONSTRAINT fk_employee_additional_day_employee
                        FOREIGN KEY (employee_id) REFERENCES employee(id)
                        ON DELETE CASCADE
                )
                """);
    }

    private void ensureEmployeeSalaryDetailsTableColumns(Connection connection) throws Exception {
        if (!tableExists(connection, "employee_salary_details")) {
            return;
        }
        ensureColumn(connection, "employee_salary_details", "pf_amount", "DOUBLE DEFAULT 0");
        ensureColumn(connection, "employee_salary_details", "pf_percentage", "DOUBLE DEFAULT 0");
        ensureColumn(connection, "employee_salary_details", "additional_allowances_total", "DOUBLE DEFAULT 0");
        ensureColumn(connection, "employee_salary_details", "additional_allowances_json", "TEXT NULL");
    }

    private void ensureAttendanceRecordColumns(Connection connection) throws Exception {
        if (!tableExists(connection, "attendance_record")) {
            return;
        }
        ensureColumn(connection, "attendance_record", "overtime_approved", "BIT DEFAULT 0");
        ensureColumn(connection, "attendance_record", "overtime_requested", "BIT DEFAULT 0");
        ensureColumn(connection, "attendance_record", "worked_hours", "DOUBLE NULL");
        ensureColumn(connection, "attendance_record", "overtime", "DOUBLE NULL");
        ensureColumn(connection, "attendance_record", "permission_used", "DOUBLE NULL");
        ensureColumn(connection, "attendance_record", "shift_id", "VARCHAR(64) NULL");
    }

    private void ensureOvertimeRequestTable(Connection connection) throws Exception {
        if (tableExists(connection, "overtime_request")) {
            ensureColumn(connection, "overtime_request", "employee_id", "BIGINT NULL");
            ensureColumn(connection, "overtime_request", "date", "VARCHAR(16) NULL");
            ensureColumn(connection, "overtime_request", "overtime_hours", "DOUBLE NOT NULL DEFAULT 0");
            ensureColumn(connection, "overtime_request", "reason", "VARCHAR(500) NULL");
            ensureColumn(connection, "overtime_request", "status", "VARCHAR(16) NOT NULL DEFAULT 'PENDING'");
            ensureColumn(connection, "overtime_request", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            ensureColumn(connection, "overtime_request", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            return;
        }
        execute(connection, """
                CREATE TABLE IF NOT EXISTS overtime_request (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    employee_id BIGINT NOT NULL,
                    date VARCHAR(16) NOT NULL,
                    overtime_hours DOUBLE NOT NULL DEFAULT 0,
                    reason VARCHAR(500) NULL,
                    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY idx_overtime_request_employee (employee_id),
                    KEY idx_overtime_request_date (date),
                    CONSTRAINT fk_overtime_request_employee
                        FOREIGN KEY (employee_id) REFERENCES employee(id)
                        ON DELETE CASCADE
                )
                """);
    }

    private void ensureHolidayTable(Connection connection) throws Exception {
        execute(connection, """
                CREATE TABLE IF NOT EXISTS holidays (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    client_id BIGINT NOT NULL,
                    holiday_date DATE NOT NULL,
                    holiday_name VARCHAR(255) NOT NULL,
                    holiday_type VARCHAR(16) NOT NULL,
                    PRIMARY KEY (id),
                    UNIQUE KEY uk_holidays_client_date (client_id, holiday_date)
                )
                """);
    }

    private void ensureAttendanceSupportRequestTable(Connection connection) throws Exception {
        if (tableExists(connection, "attendance_support_request")) {
            ensureColumn(connection, "attendance_support_request", "employee_id", "BIGINT NULL");
            ensureColumn(connection, "attendance_support_request", "attendance_date", "DATE NULL");
            ensureColumn(connection, "attendance_support_request", "time_in", "TIME NULL");
            ensureColumn(connection, "attendance_support_request", "time_out", "TIME NULL");
            ensureColumn(connection, "attendance_support_request", "reason", "VARCHAR(500) NULL");
            ensureColumn(connection, "attendance_support_request", "message", "VARCHAR(1000) NULL");
            ensureColumn(connection, "attendance_support_request", "request_type", "VARCHAR(32) NOT NULL DEFAULT 'Attendance Support'");
            ensureColumn(connection, "attendance_support_request", "status", "VARCHAR(16) NOT NULL DEFAULT 'PENDING'");
            ensureColumn(connection, "attendance_support_request", "approved_by", "VARCHAR(255) NULL");
            ensureColumn(connection, "attendance_support_request", "approved_at", "DATETIME NULL");
            ensureColumn(connection, "attendance_support_request", "approved_minutes", "INT NULL");
            ensureColumn(connection, "attendance_support_request", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            ensureColumn(connection, "attendance_support_request", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            return;
        }
        execute(connection, """
                CREATE TABLE IF NOT EXISTS attendance_support_request (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    employee_id BIGINT NOT NULL,
                    attendance_date DATE NULL,
                    time_in TIME NULL,
                    time_out TIME NULL,
                    reason VARCHAR(500) NULL,
                    message VARCHAR(1000) NULL,
                    request_type VARCHAR(32) NOT NULL DEFAULT 'Attendance Support',
                    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                    approved_by VARCHAR(255) NULL,
                    approved_at DATETIME NULL,
                    approved_minutes INT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY idx_attendance_support_employee (employee_id),
                    KEY idx_attendance_support_date (attendance_date),
                    KEY idx_attendance_support_status (status),
                    CONSTRAINT fk_attendance_support_employee
                        FOREIGN KEY (employee_id) REFERENCES employee(id)
                        ON DELETE CASCADE
                )
                """);
    }

    private void ensureColumn(Connection connection, String table, String column, String definition) throws Exception {
        if (!tableExists(connection, table) || columnExists(connection, table, column)) {
            return;
        }
        execute(connection, "ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                """)) {
            ps.setString(1, tableName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    private boolean columnExists(Connection connection, String table, String column) throws Exception {
        try (PreparedStatement ps = connection.prepareStatement("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """)) {
            ps.setString(1, table);
            ps.setString(2, column);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    private void execute(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
