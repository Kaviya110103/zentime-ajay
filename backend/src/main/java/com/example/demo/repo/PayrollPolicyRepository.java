package com.example.demo.repo;

import com.example.demo.MODELS.PayrollPolicy;
import com.example.demo.MODELS.PayrollPolicyType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayrollPolicyRepository extends JpaRepository<PayrollPolicy, Long> {
    List<PayrollPolicy> findByClientIdAndPolicyTypeAndActiveTrueOrderByPolicyNameAsc(
            Long clientId,
            PayrollPolicyType policyType);
}
