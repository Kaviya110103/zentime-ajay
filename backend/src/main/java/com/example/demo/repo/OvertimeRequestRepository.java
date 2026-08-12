package com.example.demo.repo;

import com.example.demo.MODELS.OvertimeRequest;
import com.example.demo.MODELS.OvertimeRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OvertimeRequestRepository extends JpaRepository<OvertimeRequest, Long> {
    Optional<OvertimeRequest> findFirstByEmployeeIdAndDateOrderByIdDesc(Long employeeId, String date);
    void deleteByEmployeeId(Long employeeId);

    List<OvertimeRequest> findByEmployeeIdAndStatus(Long employeeId, OvertimeRequestStatus status);

    List<OvertimeRequest> findByEmployeeClientIdOrderByIdDesc(Long clientId);

    List<OvertimeRequest> findByEmployeeClientIdAndStatusOrderByIdDesc(Long clientId, OvertimeRequestStatus status);

    @Query("""
            SELECT request
            FROM OvertimeRequest request
            JOIN FETCH request.employee employee
            WHERE (:clientId IS NULL OR employee.clientId = :clientId)
              AND (:status IS NULL OR request.status = :status)
              AND (:branch IS NULL OR LOWER(TRIM(employee.branch)) = :branch)
            ORDER BY request.id DESC
            """)
    List<OvertimeRequest> findFilteredRequests(
            @Param("clientId") Long clientId,
            @Param("status") OvertimeRequestStatus status,
            @Param("branch") String branch);
}
