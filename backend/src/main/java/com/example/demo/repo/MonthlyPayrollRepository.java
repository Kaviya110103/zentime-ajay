package com.example.demo.repo;

import com.example.demo.MODELS.MonthlyPayroll;
import com.example.demo.MODELS.PayrollCycleStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MonthlyPayrollRepository extends JpaRepository<MonthlyPayroll, Long> {
    Optional<MonthlyPayroll> findByClientIdAndEmployeeIdAndPayrollMonthAndPayrollYear(
            Long clientId,
            Long employeeId,
            Integer payrollMonth,
            Integer payrollYear);

    List<MonthlyPayroll> findByClientIdAndPayrollMonthAndPayrollYearOrderByEmployeeIdAsc(
            Long clientId,
            Integer payrollMonth,
            Integer payrollYear);

    long countByClientIdAndPayrollMonthAndPayrollYearAndStatus(
            Long clientId,
            Integer payrollMonth,
            Integer payrollYear,
            PayrollCycleStatus status);
}
