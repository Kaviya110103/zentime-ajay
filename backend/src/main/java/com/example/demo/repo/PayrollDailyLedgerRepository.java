package com.example.demo.repo;

import com.example.demo.MODELS.PayrollDailyLedger;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollDailyLedgerRepository extends JpaRepository<PayrollDailyLedger, Long> {
    Optional<PayrollDailyLedger> findByClientIdAndEmployeeIdAndPayrollDate(
            Long clientId,
            Long employeeId,
            LocalDate payrollDate);

    List<PayrollDailyLedger> findByClientIdAndEmployeeIdAndPayrollDateBetweenOrderByPayrollDateAsc(
            Long clientId,
            Long employeeId,
            LocalDate startDate,
            LocalDate endDate);

    List<PayrollDailyLedger> findByClientIdAndPayrollDateBetweenOrderByEmployeeIdAscPayrollDateAsc(
            Long clientId,
            LocalDate startDate,
            LocalDate endDate);
}
