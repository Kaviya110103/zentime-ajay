package com.example.demo.repo;

import com.example.demo.MODELS.AttendanceSupportRequest;
import com.example.demo.MODELS.AttendanceSupportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AttendanceSupportRequestRepository extends JpaRepository<AttendanceSupportRequest, Long> {
    List<AttendanceSupportRequest> findByEmployeeIdAndStatus(
            Long employeeId,
            AttendanceSupportStatus status);

    List<AttendanceSupportRequest> findByEmployeeClientIdOrderByIdDesc(Long clientId);

    List<AttendanceSupportRequest> findByEmployeeClientIdAndStatusOrderByIdDesc(
            Long clientId,
            AttendanceSupportStatus status);

    boolean existsByEmployeeIdAndAttendanceDateAndStatusAndIdNot(
            Long employeeId,
            LocalDate attendanceDate,
            AttendanceSupportStatus status,
            Long id);

    @Query("""
            SELECT request
            FROM AttendanceSupportRequest request
            JOIN FETCH request.employee employee
            WHERE (:clientId IS NULL OR employee.clientId = :clientId)
              AND (:status IS NULL OR request.status = :status)
              AND (:branch IS NULL OR LOWER(TRIM(employee.branch)) = :branch)
            ORDER BY request.id DESC
            """)
    List<AttendanceSupportRequest> findFilteredRequests(
            @Param("clientId") Long clientId,
            @Param("status") AttendanceSupportStatus status,
            @Param("branch") String branch);
}
