package com.example.demo.repo;

import com.example.demo.MODELS.PayrollStatusAudit;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollStatusAuditRepository extends JpaRepository<PayrollStatusAudit, Long> {
    List<PayrollStatusAudit> findByMonthlyPayrollIdOrderByChangedAtAsc(Long monthlyPayrollId);
}
