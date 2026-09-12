package com.example.demo.repo;

import com.example.demo.MODELS.PayrollAdjustment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollAdjustmentRepository extends JpaRepository<PayrollAdjustment, Long> {
    List<PayrollAdjustment> findByClientIdAndEmployeeIdAndPayrollMonthAndPayrollYearOrderByCreatedAtAsc(
            Long clientId,
            Long employeeId,
            Integer payrollMonth,
            Integer payrollYear);
}
