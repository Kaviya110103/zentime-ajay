package com.example.demo.repo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.demo.MODELS.AttendanceRecord;
import com.example.demo.MODELS.Employee;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {
    Optional<AttendanceRecord> findById(Long id);

    static Optional<AttendanceRecord> findTopByEmployeeIdOrderByIdDesc(Long employeeId) {
        throw new UnsupportedOperationException("Unimplemented method 'findTopByEmployeeIdOrderByIdDesc'");
    }
    List<AttendanceRecord> findByEmployeeIdAndDate(Long employeeId, String date);
    List<AttendanceRecord> findByDate(String date);
    List<AttendanceRecord> findByEmployeeIdAndDateBetween(Long employeeId, String startDate, String endDate);
    List<AttendanceRecord> findByEmployeeId(Long employeeId);
    void deleteByEmployeeId(Long employeeId);
        Optional<AttendanceRecord> findByDateAndEmployeeId(String date, Long employeeId);
List<AttendanceRecord> findByEmployeeIdOrderByIdDesc(Long employeeId);
List<AttendanceRecord> findByEmployeeIdOrderByIdDesc(Long employeeId, Pageable pageable);
List<AttendanceRecord> findByOrderByIdDesc(Pageable pageable);
List<AttendanceRecord> findByEmployee_ClientIdOrderByIdDesc(Long clientId, Pageable pageable);
@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE (:clientId IS NULL OR e.clientId = :clientId) " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRows(
        @Param("clientId") Long clientId,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.id = :employeeId AND a.date IN :dates " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByEmployeeAndDates(
        @Param("employeeId") Long employeeId,
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:employeeId IS NULL OR e.id = :employeeId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
       "AND (:datesEmpty = true OR a.date IN :dates) " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsForSearch(
        @Param("clientId") Long clientId,
        @Param("employeeId") Long employeeId,
        @Param("branch") String branch,
        @Param("dates") List<String> dates,
        @Param("datesEmpty") boolean datesEmpty,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.clientId = :clientId AND e.id = :employeeId " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByClientAndEmployeeForSearch(
        @Param("clientId") Long clientId,
        @Param("employeeId") Long employeeId,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.clientId = :clientId AND LOWER(TRIM(e.branch)) = :branch " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByClientAndBranchForSearch(
        @Param("clientId") Long clientId,
        @Param("branch") String branch,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.clientId = :clientId AND e.id = :employeeId AND LOWER(TRIM(e.branch)) = :branch " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByClientEmployeeAndBranchForSearch(
        @Param("clientId") Long clientId,
        @Param("employeeId") Long employeeId,
        @Param("branch") String branch,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.clientId = :clientId AND a.date IN :dates " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByClientAndDatesForSearch(
        @Param("clientId") Long clientId,
        @Param("dates") List<String> dates,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.clientId = :clientId AND e.id = :employeeId AND a.date IN :dates " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByClientEmployeeAndDatesForSearch(
        @Param("clientId") Long clientId,
        @Param("employeeId") Long employeeId,
        @Param("dates") List<String> dates,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.clientId = :clientId AND LOWER(TRIM(e.branch)) = :branch AND a.date IN :dates " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByClientBranchAndDatesForSearch(
        @Param("clientId") Long clientId,
        @Param("branch") String branch,
        @Param("dates") List<String> dates,
        Pageable pageable);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, " +
       "e.shiftStartTime, e.shiftEndTime, e.leavePolicyType, " +
       "a.expectedShiftStart, a.expectedShiftEnd, a.expectedMinutes, a.shiftSource " +
       "FROM AttendanceRecord a LEFT JOIN a.employee e " +
       "WHERE e.clientId = :clientId AND e.id = :employeeId AND LOWER(TRIM(e.branch)) = :branch AND a.date IN :dates " +
       "ORDER BY a.id DESC")
List<Object[]> findAttendanceRecordRowsByClientEmployeeBranchAndDatesForSearch(
        @Param("clientId") Long clientId,
        @Param("employeeId") Long employeeId,
        @Param("branch") String branch,
        @Param("dates") List<String> dates,
        Pageable pageable);
List<AttendanceRecord> findByDateOrderByIdDesc(String date, Pageable pageable);
List<AttendanceRecord> findByDateAndEmployee_ClientIdOrderByIdDesc(String date, Long clientId, Pageable pageable);
    List<AttendanceRecord> findByDateAndAttendanceStatus(String date, String attendanceStatus);
    List<AttendanceRecord> findByDateAndAttendanceStatusOrderByIdDesc(String date, String attendanceStatus, Pageable pageable);
    List<AttendanceRecord> findByDateAndAttendanceStatusAndEmployee_ClientIdOrderByIdDesc(String date, String attendanceStatus, Long clientId, Pageable pageable);
    // Get latest record by employee (based on id descending or date descending)
    @Query("SELECT a FROM AttendanceRecord a WHERE a.employee = :employee ORDER BY a.id DESC LIMIT 1")
    Optional<AttendanceRecord> findLatestByEmployee(Employee employee);
    @Query("SELECT a FROM AttendanceRecord a WHERE a.date = :date AND a.timeIn IS NOT NULL")
List<AttendanceRecord> findAllTimeInByDate(@Param("date") String date);

@Query("SELECT a FROM AttendanceRecord a WHERE a.date = :today AND a.attendanceStatus = 'Absent'")
List<AttendanceRecord> findTodayAbsent(@Param("today") String today);

    // You can add custom query methods here if needed, e.g.,
    // findByEmployeeIdAndDate(Long employeeId, LocalDate date);

    List<AttendanceRecord> findByAttendanceStatus(String status);
    List<AttendanceRecord> findByDayStatus(String dayStatus);
    List<AttendanceRecord> findByLocationContainingIgnoreCase(String location);
    List<AttendanceRecord> findByDateBetween(String startDate, String endDate);
    // List<AttendanceRecord> findByMissedTimesBetween(Integer min, Integer max);
    List<AttendanceRecord> findByLeavePermissions_Status(String status);


List<AttendanceRecord> findByAttendanceStatusAndTimeOutIsNull(String attendanceStatus);
List<AttendanceRecord> findByAttendanceStatusAndTimeOutIsNullOrderByIdDesc(String attendanceStatus, Pageable pageable);
long countByAttendanceStatusAndTimeOutIsNull(String attendanceStatus);
long countByAttendanceStatusAndTimeOutIsNullAndEmployee_ClientId(String attendanceStatus, Long clientId);
List<AttendanceRecord> findByAttendanceStatusAndTimeOutIsNullAndEmployee_ClientId(String attendanceStatus, Long clientId);
List<AttendanceRecord> findByAttendanceStatusAndTimeOutIsNullAndEmployee_ClientIdOrderByIdDesc(String attendanceStatus, Long clientId, Pageable pageable);

@Query("SELECT a.id, e.firstName, e.lastName, e.mobile, e.branch, e.position, a.date " +
       "FROM AttendanceRecord a JOIN a.employee e " +
       "WHERE a.attendanceStatus = :attendanceStatus AND a.timeOut IS NULL " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
       "ORDER BY a.id DESC")
List<Object[]> findMissedTimeoutRows(
        @Param("attendanceStatus") String attendanceStatus,
        @Param("clientId") Long clientId,
        @Param("branch") String branch,
        Pageable pageable);

@Query("SELECT a.id, e.id, e.firstName, e.lastName, e.mobile, e.branch, a.date " +
       "FROM AttendanceRecord a JOIN a.employee e " +
       "WHERE a.attendanceStatus = :attendanceStatus AND a.date IN :dates " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
       "ORDER BY a.id DESC")
List<Object[]> findTodayAbsentRows(
        @Param("attendanceStatus") String attendanceStatus,
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId,
        @Param("branch") String branch);

@Query("SELECT a.id, e.firstName, e.lastName, e.mobile, e.branch, e.position, a.date, a.TimoutReason, a.timeOut " +
       "FROM AttendanceRecord a JOIN a.employee e " +
       "WHERE a.attendanceStatus = :attendanceStatus " +
       "AND a.timeOut IS NOT NULL " +
       "AND a.TimoutReason IS NOT NULL " +
       "AND TRIM(a.TimoutReason) <> '' " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
       "ORDER BY a.id DESC")
List<Object[]> findCompletedMissedTimeoutRows(
        @Param("attendanceStatus") String attendanceStatus,
        @Param("clientId") Long clientId,
        @Param("branch") String branch,
        Pageable pageable);

@Query("SELECT COUNT(a) FROM AttendanceRecord a JOIN a.employee e " +
       "WHERE a.attendanceStatus = :attendanceStatus AND a.timeOut IS NULL " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch)")
long countMissedTimeoutRows(
        @Param("attendanceStatus") String attendanceStatus,
        @Param("clientId") Long clientId,
        @Param("branch") String branch);

@Query("SELECT a FROM AttendanceRecord a WHERE a.attendanceStatus = :attendanceStatus " +
       "AND a.timeOut IS NOT NULL " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND a.employee.clientId = :clientId)) " +
       "AND (:branch IS NULL OR LOWER(TRIM(a.employee.branch)) = :branch) " +
       "ORDER BY a.id DESC")
List<AttendanceRecord> findCompletedPresentWithTimeOut(
        @Param("attendanceStatus") String attendanceStatus,
        @Param("clientId") Long clientId,
        @Param("branch") String branch,
        Pageable pageable);

@Query("SELECT a FROM AttendanceRecord a WHERE a.date = :date AND a.timeIn IS NOT NULL AND a.attendanceStatus = 'Present' " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND a.employee.clientId = :clientId))")
List<AttendanceRecord> findTodayPresentTimeInByDateAndClient(
        @Param("date") String date,
        @Param("clientId") Long clientId);

@Query("SELECT a.id, e.id, e.firstName, e.lastName, e.branch, e.mobile, e.profileImage, " +
       "a.timeIn, a.timeOut, a.location, a.attendanceStatus, e.shiftStart, e.shiftStartTime " +
       "FROM AttendanceRecord a JOIN a.employee e " +
       "WHERE a.date = :date AND a.timeIn IS NOT NULL AND a.attendanceStatus = 'Present' " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "ORDER BY a.id DESC")
List<Object[]> findTodayPresentTimeInRowsByDateAndClient(
        @Param("date") String date,
        @Param("clientId") Long clientId,
        Pageable pageable);

@Query("SELECT a.id, e.id, e.firstName, e.lastName, e.branch, e.mobile, e.profileImage, " +
       "a.timeIn, a.timeOut, a.location, a.attendanceStatus, e.shiftStart, e.shiftStartTime " +
       "FROM AttendanceRecord a JOIN a.employee e " +
       "WHERE a.date = :date AND a.timeIn IS NOT NULL AND a.attendanceStatus = 'Present' " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
       "ORDER BY a.id DESC")
List<Object[]> findTodayPresentTimeInRowsByDateAndClientAndBranch(
        @Param("date") String date,
        @Param("clientId") Long clientId,
        @Param("branch") String branch,
        Pageable pageable);

@Query("SELECT a FROM AttendanceRecord a WHERE a.date = :date AND a.timeIn IS NOT NULL AND a.attendanceStatus = 'Present' " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND a.employee.clientId = :clientId)) " +
       "ORDER BY a.id DESC")
List<AttendanceRecord> findTodayPresentTimeInByDateAndClient(
        @Param("date") String date,
        @Param("clientId") Long clientId,
        Pageable pageable);

@Query("SELECT a FROM AttendanceRecord a WHERE a.attendanceStatus = :status AND a.date IN :dates " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND a.employee.clientId = :clientId))")
List<AttendanceRecord> findByStatusAndDatesAndClient(
        @Param("status") String status,
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId);

@Query("SELECT a FROM AttendanceRecord a LEFT JOIN FETCH a.employee e WHERE a.attendanceStatus = :status AND a.date IN :dates " +
       "AND (:clientId IS NULL OR (e IS NOT NULL AND e.clientId = :clientId)) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch)")
List<AttendanceRecord> findByStatusAndDatesAndClientAndBranch(
        @Param("status") String status,
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId,
        @Param("branch") String branch);

@Query("SELECT a FROM AttendanceRecord a LEFT JOIN FETCH a.employee e WHERE a.date IN :dates " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND e.clientId = :clientId)) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
       "ORDER BY a.id DESC")
List<AttendanceRecord> findByDatesAndClientOrderByIdDesc(
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId,
        @Param("branch") String branch);

@Query("SELECT a.id, a.timeIn, a.timeOut, a.dayStatus, a.location, a.attendanceStatus, a.date, " +
       "a.missedTimes, a.workedHours, a.overtime, a.permissionUsed, a.shiftId, " +
       "e.id, e.firstName, e.lastName, e.branch, e.employeeCode, e.weekOff, e.mobile, " +
       "e.shiftStartTime, e.shiftEndTime, e.shiftStart, e.shiftEnd, e.leavePolicyType " +
       "FROM AttendanceRecord a JOIN a.employee e " +
       "WHERE a.date IN :dates " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "AND (:branch IS NULL OR LOWER(TRIM(e.branch)) = :branch) " +
       "ORDER BY a.id DESC")
List<Object[]> findDashboardSummaryRowsByDatesAndClient(
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId,
        @Param("branch") String branch);

@Query("SELECT a FROM AttendanceRecord a LEFT JOIN FETCH a.employee e " +
       "WHERE e.id = :employeeId " +
       "AND a.date IN :dates " +
       "AND (:clientId IS NULL OR e.clientId = :clientId) " +
       "ORDER BY a.id ASC")
List<AttendanceRecord> findByEmployeeIdAndDatesWithEmployee(
        @Param("employeeId") Long employeeId,
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId);

@Query("SELECT COUNT(a) FROM AttendanceRecord a WHERE a.attendanceStatus = :status AND a.date IN :dates " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND a.employee.clientId = :clientId))")
long countByStatusAndDatesAndClient(
        @Param("status") String status,
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId);

@Query("SELECT COUNT(a) FROM AttendanceRecord a WHERE a.date IN :dates " +
       "AND COALESCE(a.missedTimes, 0) > 0 " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND a.employee.clientId = :clientId))")
long countLateByDatesAndClient(
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId);

@Query("SELECT COALESCE(SUM(a.missedTimes), 0) FROM AttendanceRecord a WHERE a.date IN :dates " +
       "AND (:clientId IS NULL OR (a.employee IS NOT NULL AND a.employee.clientId = :clientId))")
long sumMissedMinutesByDatesAndClient(
        @Param("dates") List<String> dates,
        @Param("clientId") Long clientId);
// Find by employeeId and month pattern in date (e.g., /06/2025)
@Query("SELECT a FROM AttendanceRecord a WHERE a.employee.id = :employeeId AND a.date LIKE %:monthPattern")
List<AttendanceRecord> findByEmployeeIdAndMonthPattern(@Param("employeeId") Long employeeId, @Param("monthPattern") String monthPattern);

// Find by employee branch
@Query("SELECT a FROM AttendanceRecord a WHERE a.employee.branch = :branch")
List<AttendanceRecord> findByEmployeeBranch(@Param("branch") String branch);

// Find by month pattern and date
@Query("SELECT a FROM AttendanceRecord a WHERE a.date LIKE %:monthPattern AND a.date = :date")
List<AttendanceRecord> findByMonthPatternAndDate(@Param("monthPattern") String monthPattern, @Param("date") String date);
@Query("SELECT DISTINCT a.employee.branch FROM AttendanceRecord a")
List<String> findAllDistinctBranches();
// Already present in your repo:
// Optional<AttendanceRecord> findByDateAndEmployeeId(String date, Long employeeId);
// List<AttendanceRecord> findByEmployeeId(Long employeeId);
// List<AttendanceRecord> findByDateAndAttendanceStatus(String date, String attendanceStatus);




@Query("SELECT a FROM AttendanceRecord a WHERE a.attendanceStatus = :attendanceStatus AND a.date LIKE %:monthPattern")
List<AttendanceRecord> findByAttendanceStatusAndMonthPattern(@Param("attendanceStatus") String attendanceStatus, @Param("monthPattern") String monthPattern);

@Query("SELECT a FROM AttendanceRecord a WHERE a.date LIKE %:monthPattern AND a.attendanceStatus = :attendanceStatus AND a.employee.branch = :branch")
List<AttendanceRecord> findByMonthStatusBranch(@Param("monthPattern") String monthPattern, @Param("attendanceStatus") String attendanceStatus, @Param("branch") String branch);


    /** One record for one employee on one date (dd/MM/yyyy) */
    Optional<AttendanceRecord> findByEmployee_IdAndDate(Long employeeId, String date);

    /** All records for employee between two dates (inclusive) */
    @Query("SELECT a FROM AttendanceRecord a " +
           "WHERE a.employee.id = :employeeId AND a.date BETWEEN :start AND :end")
    List<AttendanceRecord> findMonthlySlice(
            @Param("employeeId") Long employeeId,
            @Param("start") String startDate,   // dd/MM/yyyy
            @Param("end")   String endDate);    // dd/MM/yyyy
Long countByDateAndDayStatusNot(String date, String dayStatus);



}
