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
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "monthly_payroll",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_monthly_payroll_employee_period",
                        columnNames = {"client_id", "employee_id", "payroll_month", "payroll_year"})
        })
@Getter
@Setter
@NoArgsConstructor
public class MonthlyPayroll {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "payroll_month", nullable = false)
    private Integer payrollMonth;

    @Column(name = "payroll_year", nullable = false)
    private Integer payrollYear;

    @Column(name = "gross_salary", precision = 14, scale = 2)
    private BigDecimal grossSalary = BigDecimal.ZERO;

    @Column(name = "paid_units", precision = 7, scale = 2)
    private BigDecimal paidUnits = BigDecimal.ZERO;

    @Column(name = "lop_units", precision = 7, scale = 2)
    private BigDecimal lopUnits = BigDecimal.ZERO;

    @Column(name = "worked_minutes", nullable = false)
    private Integer workedMinutes = 0;

    @Column(name = "expected_minutes", nullable = false)
    private Integer expectedMinutes = 0;

    @Column(name = "approved_ot_minutes", nullable = false)
    private Integer approvedOtMinutes = 0;

    @Column(name = "basic_pay", precision = 14, scale = 2)
    private BigDecimal basicPay = BigDecimal.ZERO;

    @Column(name = "hra_pay", precision = 14, scale = 2)
    private BigDecimal hraPay = BigDecimal.ZERO;

    @Column(name = "allowance_pay", precision = 14, scale = 2)
    private BigDecimal allowancePay = BigDecimal.ZERO;

    @Column(name = "ot_amount", precision = 14, scale = 2)
    private BigDecimal otAmount = BigDecimal.ZERO;

    @Column(name = "bonus", precision = 14, scale = 2)
    private BigDecimal bonus = BigDecimal.ZERO;

    @Column(name = "incentive", precision = 14, scale = 2)
    private BigDecimal incentive = BigDecimal.ZERO;

    @Column(name = "arrears", precision = 14, scale = 2)
    private BigDecimal arrears = BigDecimal.ZERO;

    @Column(name = "pf", precision = 14, scale = 2)
    private BigDecimal pf = BigDecimal.ZERO;

    @Column(name = "esi", precision = 14, scale = 2)
    private BigDecimal esi = BigDecimal.ZERO;

    @Column(name = "professional_tax", precision = 14, scale = 2)
    private BigDecimal professionalTax = BigDecimal.ZERO;

    @Column(name = "lop_deduction", precision = 14, scale = 2)
    private BigDecimal lopDeduction = BigDecimal.ZERO;

    @Column(name = "advance_recovery", precision = 14, scale = 2)
    private BigDecimal advanceRecovery = BigDecimal.ZERO;

    @Column(name = "other_deduction", precision = 14, scale = 2)
    private BigDecimal otherDeduction = BigDecimal.ZERO;

    @Column(name = "total_earnings", precision = 14, scale = 2)
    private BigDecimal totalEarnings = BigDecimal.ZERO;

    @Column(name = "total_deductions", precision = 14, scale = 2)
    private BigDecimal totalDeductions = BigDecimal.ZERO;

    @Column(name = "net_salary", precision = 14, scale = 2)
    private BigDecimal netSalary = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PayrollCycleStatus status = PayrollCycleStatus.DRAFT;

    @Column(name = "approved_by", length = 255)
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "locked_by", length = 255)
    private String lockedBy;

    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Column(name = "payslip_id", length = 128)
    private String payslipId;

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
