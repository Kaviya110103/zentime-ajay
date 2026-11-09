package com.example.demo.repo;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.demo.MODELS.MissedTimeoutSubmission;

public interface MissedTimeoutSubmissionRepository extends JpaRepository<MissedTimeoutSubmission, Long> {
    boolean existsByAttendanceRecordId(Long attendanceRecordId);

    long countByEmployeeIdAndSubmittedAtGreaterThanEqualAndSubmittedAtLessThan(
            Long employeeId,
            LocalDateTime monthStart,
            LocalDateTime nextMonthStart);

    @Query("SELECT s.id, a.id, e.id, e.firstName, e.lastName, e.mobile, e.branch, e.position, " +
            "s.attendanceDate, s.clockOutTime, s.reason, s.submittedAt " +
            "FROM MissedTimeoutSubmission s " +
            "JOIN s.employee e JOIN s.attendanceRecord a " +
            "WHERE (:clientId IS NULL OR e.clientId = :clientId) " +
            "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
            "ORDER BY s.submittedAt DESC")
    List<Object[]> findSubmittedReportRows(
            @Param("clientId") Long clientId,
            @Param("branch") String branch,
            Pageable pageable);
}
