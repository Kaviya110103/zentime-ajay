package com.example.demo.MODELS;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
        name = "employee_payroll_config",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_employee_payroll_config_effective",
                        columnNames = {"client_id", "employee_id", "effective_from"})
        })
@Getter
@Setter
@NoArgsConstructor
public class EmployeePayrollConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "monthly_gross_salary", precision = 14, scale = 2)
    private BigDecimal monthlyGrossSalary = BigDecimal.ZERO;

    @Column(precision = 14, scale = 2)
    private BigDecimal basic = BigDecimal.ZERO;

    @Column(precision = 14, scale = 2)
    private BigDecimal hra = BigDecimal.ZERO;

    @Column(precision = 14, scale = 2)
    private BigDecimal allowances = BigDecimal.ZERO;

    @Column(name = "shift_reference", length = 128)
    private String shiftReference;

    @Column(name = "weekly_off_policy_reference", length = 128)
    private String weeklyOffPolicyReference;

    @Column(name = "paid_leave_policy_reference", length = 128)
    private String paidLeavePolicyReference;

    @Column(name = "unpaid_leave_policy_reference", length = 128)
    private String unpaidLeavePolicyReference;

    @Column(name = "late_policy_id")
    private Long latePolicyId;

    @Column(name = "permission_policy_id")
    private Long permissionPolicyId;

    @Column(name = "overtime_rate", precision = 14, scale = 2)
    private BigDecimal overtimeRate = BigDecimal.ZERO;

    @Column(name = "pf_enabled", nullable = false)
    private Boolean pfEnabled = false;

    @Column(name = "pf_amount", precision = 14, scale = 2)
    private BigDecimal pfAmount = BigDecimal.ZERO;

    @Column(name = "pf_percentage", precision = 7, scale = 2)
    private BigDecimal pfPercentage = BigDecimal.ZERO;

    @Column(name = "esi_enabled", nullable = false)
    private Boolean esiEnabled = false;

    @Column(name = "esi_amount", precision = 14, scale = 2)
    private BigDecimal esiAmount = BigDecimal.ZERO;

    @Column(name = "esi_percentage", precision = 7, scale = 2)
    private BigDecimal esiPercentage = BigDecimal.ZERO;

    @Column(name = "professional_tax", precision = 14, scale = 2)
    private BigDecimal professionalTax = BigDecimal.ZERO;

    @Column(name = "other_deductions", precision = 14, scale = 2)
    private BigDecimal otherDeductions = BigDecimal.ZERO;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(name = "created_by", length = 255)
    private String createdBy;

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
