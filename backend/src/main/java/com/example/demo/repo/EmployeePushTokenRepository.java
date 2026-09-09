package com.example.demo.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.demo.MODELS.EmployeePushToken;

public interface EmployeePushTokenRepository extends JpaRepository<EmployeePushToken, Long> {
    Optional<EmployeePushToken> findByEmployeeIdAndToken(Long employeeId, String token);

    void deleteByEmployeeId(Long employeeId);

    List<EmployeePushToken> findByEmployeeId(Long employeeId);

    @Query("select t.token from EmployeePushToken t")
    List<String> findAllTokens();

    @Query("select t.token from EmployeePushToken t where t.employee.clientId = :clientId")
    List<String> findTokensByEmployeeClientId(@Param("clientId") Long clientId);

    @Query("""
            select t.token from EmployeePushToken t
            where t.employee.clientId = :clientId
              and lower(trim(t.employee.branch)) = :branch
            """)
    List<String> findTokensByEmployeeClientIdAndBranch(
            @Param("clientId") Long clientId,
            @Param("branch") String branch);
}
