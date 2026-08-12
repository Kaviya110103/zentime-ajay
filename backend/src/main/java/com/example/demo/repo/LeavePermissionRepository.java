package com.example.demo.repo;



import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.demo.MODELS.LeavePermission;

import java.util.List;


public interface LeavePermissionRepository extends JpaRepository<LeavePermission, Long> {
    List<LeavePermission> findByEmployeeId(Long employeeId);
    void deleteByEmployeeId(Long employeeId);
    List<LeavePermission> findByStatusIgnoreCase(String status);
    List<LeavePermission> findByEmployee_ClientId(Long clientId);
    List<LeavePermission> findByStatusIgnoreCaseAndEmployee_ClientId(String status, Long clientId);
    List<LeavePermission> findByEmployeeIdAndStatus(Long employeeId, String status);
    List<LeavePermission> findByEmployeeIdAndDateAndStatus(Long employeeId, String date, String status);
     long countByStatusIgnoreCase(String status);
     long countByStatusIgnoreCaseAndEmployee_ClientId(String status, Long clientId);
     @Query("""
             SELECT COUNT(leave)
             FROM LeavePermission leave
             JOIN leave.employee employee
             WHERE LOWER(leave.status) = LOWER(:status)
               AND (:clientId IS NULL OR employee.clientId = :clientId)
               AND (:branch IS NULL OR LOWER(TRIM(employee.branch)) = :branch)
             """)
     long countByStatusClientAndBranch(
             @Param("status") String status,
             @Param("clientId") Long clientId,
             @Param("branch") String branch);

     @Query("""
             SELECT leave
             FROM LeavePermission leave
             JOIN FETCH leave.employee employee
             WHERE (:clientId IS NULL OR employee.clientId = :clientId)
               AND (:requestType IS NULL OR LOWER(leave.leaveType) = :requestType)
               AND (:branch IS NULL OR LOWER(TRIM(employee.branch)) = :branch)
             ORDER BY leave.id DESC
             """)
     List<LeavePermission> findFilteredRequests(
             @Param("clientId") Long clientId,
             @Param("requestType") String requestType,
             @Param("branch") String branch);
}
