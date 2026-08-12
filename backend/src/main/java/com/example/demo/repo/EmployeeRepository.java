package com.example.demo.repo;



import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.demo.MODELS.Employee;


public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByUsername(String username);
    Optional<Employee> findFirstByUsernameIgnoreCase(String username);
    Optional<Employee> findByUsernameAndClientId(String username, Long clientId);
    Optional<Employee> findByUsernameIgnoreCaseAndIdNot(String username, Long id);
    Optional<Employee> findByEmployeeCode(String employeeCode);
    Optional<Employee> findByEmail(String email);
    Optional<Employee> findByEmailIgnoreCaseAndIdNot(String email, Long id);
    Optional<Employee> findByIdAndClientId(Long id, Long clientId);

     Optional<Employee> findByUsernameAndPassword(String username, String password);

     List<Employee> findByBranch(String branch);
     List<Employee> findByBranchIgnoreCase(String branch);
        //  List<Employee> findByBranch(String branchName);
List<Employee> findByGuestNameIsNotNullAndGuestStartDateBefore(LocalDateTime cutoffTime);
List<Employee> findByClientId(Long clientId);
List<Employee> findByClientIdAndBranchIgnoreCase(Long clientId, String branch);
List<Employee> findByCompanyCode(String companyCode);
long countByClientId(Long clientId);
long countByClientIdAndBranchIgnoreCase(Long clientId, String branch);
long countByBranchIgnoreCase(String branch);

@Query("SELECT e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, e.mobile, " +
       "e.shiftStartTime, e.shiftEndTime, e.shiftStart, e.shiftEnd, e.leavePolicyType " +
       "FROM Employee e " +
       "WHERE (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch)")
List<Object[]> findDashboardEmployeeRows(
        @Param("clientId") Long clientId,
        @Param("branch") String branch);

}
