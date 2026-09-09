package com.example.demo.repo;

import com.example.demo.MODELS.EmployeePayrollConfig;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeePayrollConfigRepository extends JpaRepository<EmployeePayrollConfig, Long> {
    List<EmployeePayrollConfig> findByClientIdAndEmployeeIdOrderByEffectiveFromDesc(Long clientId, Long employeeId);

    @Query("""
            select config
            from EmployeePayrollConfig config
            where config.clientId = :clientId
              and config.employeeId = :employeeId
              and config.effectiveFrom <= :date
              and (config.effectiveTo is null or config.effectiveTo >= :date)
            order by config.effectiveFrom desc
            """)
    Optional<EmployeePayrollConfig> findEffectiveConfig(
            @Param("clientId") Long clientId,
            @Param("employeeId") Long employeeId,
            @Param("date") LocalDate date);
}
