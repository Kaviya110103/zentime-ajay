package com.example.demo.MODELS;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "payroll_daily_ledger",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_payroll_daily_ledger_employee_date",
                        columnNames = {"client_id", "employee_id", "payroll_date"})
        })
@Getter
@Setter
@NoArgsConstructor
public class PayrollDailyLedger {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "payroll_date", nullable = false)
    private LocalDate payrollDate;

    @Column(name = "attendance_record_id")
    private Long attendanceRecordId;

    @Column(name = "attendance_status", length = 64)
    private String attendanceStatus;

    @Column(name = "display_status", length = 64)
    private String displayStatus;

    @Column(name = "count_status", length = 64)
    private String countStatus;

    @Column(name = "worked_minutes", nullable = false)
    private Integer workedMinutes = 0;

    @Column(name = "expected_minutes", nullable = false)
    private Integer expectedMinutes = 0;

    @Column(name = "paid_unit", precision = 5, scale = 2, nullable = false)
    private BigDecimal paidUnit = BigDecimal.ZERO;

    @Column(name = "lop_unit", precision = 5, scale = 2, nullable = false)
    private BigDecimal lopUnit = BigDecimal.ZERO;

    @Column(name = "late_minutes", nullable = false)
    private Integer lateMinutes = 0;

    @Column(name = "early_out_minutes", nullable = false)
    private Integer earlyOutMinutes = 0;

    @Column(name = "permission_minutes", nullable = false)
    private Integer permissionMinutes = 0;

    @Column(name = "overtime_potential_minutes", nullable = false)
    private Integer overtimePotentialMinutes = 0;

    @Column(name = "overtime_approved_minutes", nullable = false)
    private Integer overtimeApprovedMinutes = 0;

    @Column(name = "leave_type", length = 64)
    private String leaveType;

    @Enumerated(EnumType.STRING)
    @Column(name = "payroll_status", nullable = false, length = 32)
    private PayrollLedgerStatus payrollStatus = PayrollLedgerStatus.OPEN;

    @Column(name = "remarks", length = 1000)
    private String remarks;

    @Column(name = "source_classification_version", length = 64)
    private String sourceClassificationVersion;

    @Column(name = "source_classification_at")
    private LocalDateTime sourceClassificationAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
