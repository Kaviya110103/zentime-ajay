package com.example.demo.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.MODELS.EmailDetails;
import com.example.demo.MODELS.Employee;
import com.example.demo.service.AdditionalWorkingDayService;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.service.AttendanceMetricsService;
import com.example.demo.service.EmailService;
import com.example.demo.service.PayrollCalculationService;
import com.example.demo.service.PayrollLogoStorageService;
import com.example.demo.service.PayslipPdfService;

@RestController
@RequestMapping("/api/payroll")
@CrossOrigin(origins = "*")
public class PayrollController {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PayrollCalculationService payrollCalculationService;

    @Autowired
    private AttendanceMetricsService attendanceMetricsService;

    @Autowired
    private com.example.demo.service.SchemaMaintenanceService schemaMaintenanceService;

    @Autowired
    private AdditionalWorkingDayService additionalWorkingDayService;

    @Autowired
    private PayrollLogoStorageService payrollLogoStorageService;

    @Autowired
    private PayslipPdfService payslipPdfService;

    @GetMapping("/month-payroll")
    public ResponseEntity<?> calculateMonthPayroll(
            @RequestParam("employeeId") Long employeeId,
            @RequestParam("month") int month,
            @RequestParam("year") int year,
            @RequestParam(value = "clientId", required = false) Long clientId,
            @RequestParam(value = "branch", required = false) String branch,
            @RequestParam(value = "debug", required = false, defaultValue = "false") boolean debug) {
        schemaMaintenanceService.ensureEmployeeSchema();
        Optional<Employee> employeeOpt = clientId == null
                ? employeeRepository.findById(employeeId)
                : employeeRepository.findByIdAndClientId(employeeId, clientId);
        Employee employee = employeeOpt.orElse(null);
        if (employee == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Employee not found");
        }
        if (branch != null && !branch.isBlank()
                && (employee.getBranch() == null || !employee.getBranch().trim().equalsIgnoreCase(branch.trim()))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Employee not found in selected branch");
        }
        double salary = employee.getSalary() == null ? 0.0 : employee.getSalary();

        PayrollCalculationService.PayrollResult result =
                payrollCalculationService.calculateMonthlyPayroll(employeeId, month, year, clientId);

        int daysInMonth = result.daysInMonth();
        double holidayTotalDays = result.publicHolidayDays();
        int weekOffDays = Math.max(0, result.configuredWeekOffDays());
        int approvedLeaveTakenCount = Math.max(
                0,
                result.paidLeaveDays()
                        + result.paidCasualDays()
                        + result.unpaidCasualDays()
                        + result.unpaidLeaveDays());
        AttendanceMetricsService.MonthlyMetrics metrics;
        try {
            metrics = attendanceMetricsService.calculateMonthlyMetrics(employeeId, month, year);
        } catch (Exception ex) {
            ex.printStackTrace();
            metrics = AttendanceMetricsService.MonthlyMetrics.empty();
        }
        int permissionTakenCount = metrics.approvedPermissionCount();
        int permissionTakenMinutes = result.permissionDurationMinutes();
        int permissionAllowancePerMonth = attendanceMetricsService.resolveMaxApprovedPermissionsPerMonth(employee);
        int permissionAllowedMinutes = attendanceMetricsService.resolveMaxApprovedPermissionMinutesPerMonth(employee);
        int lateDays = result.lateAttendanceDays();
        int totalLateMinutes = result.lateAttendanceMinutes();
        int absentDays = Math.max(0, result.absentDays());

        Map<String, Object> response = new HashMap<>();
        response.put("employeeId", employeeId);
        response.put("employeeName", employee.getFirstName() + " " + employee.getLastName());
        response.put("firstName", employee.getFirstName());
        response.put("lastName", employee.getLastName());
        response.put("mobile", employee.getMobile());
        response.put("position", employee.getPosition());
        response.put("branch", employee.getBranch());
        response.put("email", employee.getEmail());
        response.put("profileImage", employee.getProfileImage());
        response.put("leavePolicyType", employee.getLeavePolicyType());
        response.put("weekOffDay", employee.getWeekOff());
        response.put("shiftStartTime", employee.getShiftStartTime());
        response.put("shiftEndTime", employee.getShiftEndTime());
        response.put("regularShiftMinutes", resolveShiftMinutes(employee.getShiftStartTime(), employee.getShiftEndTime()));
        response.put("shiftStart", employee.getShiftStart());
        response.put("shiftEnd", employee.getShiftEnd());
        response.put("additionalWorkingDays", buildAdditionalWorkingDaysResponse(employee));
        response.put("month", month);
        response.put("year", year);
        response.put("salary", salary);
        response.put("daysInMonth", daysInMonth);
        response.put("scheduledDays", result.scheduledWorkingDays());
        response.put("weekOffDays", weekOffDays);
        response.put("workedDays", result.workedDays());
        response.put("absentDays", absentDays);
        response.put("lateDays", lateDays);
        response.put("totalLateMinutes", totalLateMinutes);
        response.put("approvedLeaveTakenCount", approvedLeaveTakenCount);
        response.put("casualLeaveBalance", employee.getCasualLeaveBalance() == null ? 0 : employee.getCasualLeaveBalance());
        response.put("permissionAllowancePerMonth", permissionAllowancePerMonth);
        response.put("permissionHoursAllowed", employee.getPermissionHoursAllowed() == null ? 2.0 : employee.getPermissionHoursAllowed());
        response.put("permissionAllowedMinutes", permissionAllowedMinutes);
        response.put("permissionTakenCount", permissionTakenCount);
        response.put("permissionTakenMinutes", permissionTakenMinutes);
        response.put("holidayDaysFull", result.holidayDaysFull());
        response.put("holidayDaysHalf", result.holidayDaysHalf());
        response.put("holidayDaysTotal", holidayTotalDays);
        response.put("paidLeaveDays", result.paidLeaveDays());
        response.put("paidCasualDays", result.paidCasualDays());
        response.put("unpaidCasualDays", result.unpaidCasualDays());
        response.put("unpaidLeaveDays", result.unpaidLeaveDays());
        response.put("expectedHours", result.expectedHours());
        response.put("payableHours", result.payableHours());
        response.put("workedHours", result.workedHours());
        response.put("expectedWorkingMinutes", result.expectedWorkingMinutes());
        response.put("presentWorkingMinutes", result.presentWorkingMinutes());
        response.put("payablePresentMinutes", result.payablePresentMinutes());
        response.put("payableWorkingMinutes", result.payableWorkingMinutes());
        response.put("payablePresentDays", result.payablePresentDays());
        response.put("absentPayableDays", result.absentPayableDays());
        response.put("perDaySalary", result.perDaySalary());
        response.put("perMinuteSalary", result.perMinuteSalary());
        response.put("perHourSalary", result.perHourSalary());
        response.put("absentMinutes", result.absentMinutes());
        response.put("missingHours", result.missingHours());
        response.put("netSalary", result.netSalary());
        response.put("overtimeHours", result.overtimeHours());
        response.put("overtimeMinutes", Math.max(0, (int) Math.round(result.overtimeHours() * 60.0)));

        Map<String, Object> expectedAttendance = new HashMap<>();
        expectedAttendance.put("totalCalendarDays", result.daysInMonth());
        expectedAttendance.put("configuredWeekOffs", result.configuredWeekOffDays());
        expectedAttendance.put("publicHolidays", result.publicHolidayDays());
        expectedAttendance.put("clEntitlement", result.clEntitlementDays());
        expectedAttendance.put("scheduledWorkingDays", result.scheduledWorkingDays());

        Map<String, Object> actualAttendance = new HashMap<>();
        actualAttendance.put("presentWorkingDays", result.workedDays());
        actualAttendance.put("weekOffDays", result.configuredWeekOffDays());
        actualAttendance.put("lateAttendanceDays", result.lateAttendanceDays());
        actualAttendance.put("lateAttendanceMinutes", result.lateAttendanceMinutes());
        actualAttendance.put("clUtilized", result.clUtilizedDays());
        actualAttendance.put("permissionDurationMinutes", result.permissionDurationMinutes());
        actualAttendance.put("publicHolidays", result.publicHolidayDays());

        Map<String, Object> salaryCalculation = new HashMap<>();
        salaryCalculation.put("basicSalary", result.basicSalary());
        salaryCalculation.put("earnedSalary", result.estimatedNetSalary());
        salaryCalculation.put("scheduledWorkingMinutes", result.scheduledWorkingMinutes());
        salaryCalculation.put("payableWorkingMinutes", result.payableWorkingMinutes());
        salaryCalculation.put("perMinuteRate", result.perMinuteRate());
        salaryCalculation.put("estimatedNetSalary", result.estimatedNetSalary());
        salaryCalculation.put("lateAmount", result.lateAmount());
        salaryCalculation.put("unpaidMissingMinutes", result.unpaidMissingMinutes());
        salaryCalculation.put("unpaidMissingAmount", result.attendanceDeduction());
        salaryCalculation.put("lopAmount", result.attendanceDeduction());
        salaryCalculation.put("permissionExcessMinutes", result.permissionExcessMinutes());
        salaryCalculation.put("permissionExcessAmount", result.permissionExcessAmount());

        response.put("expectedAttendance", expectedAttendance);
        response.put("actualAttendance", actualAttendance);
        response.put("salaryCalculation", salaryCalculation);
        response.put("dailyRows", result.dailyRows());
        Map<String, Long> attendanceSummary = new HashMap<>();
        attendanceSummary.put("total", (long) result.dailyRows().size());
        Map<String, String> summaryStatuses = Map.of("present", "Present", "absent", "Absent", "weekOff", "Week Off", "holiday", "Holiday");
        summaryStatuses.forEach((key, value) -> attendanceSummary.put(key,
                result.dailyRows().stream().filter(row -> value.equals(row.get("countStatus"))).count()));
        response.put("attendanceSummary", attendanceSummary);
        response.put("overtimeAmount", result.overtimeAmount());
        response.put("proratedBasic", result.proratedBasic());
        response.put("lateAmount", result.lateAmount());
        response.put("unpaidMissingMinutes", result.unpaidMissingMinutes());
        response.put("attendanceDeduction", result.attendanceDeduction());
        response.put("lopAmount", result.attendanceDeduction());
        response.put("permissionExcessMinutes", result.permissionExcessMinutes());
        response.put("permissionExcessAmount", result.permissionExcessAmount());
        response.put("payrollStatus", java.time.YearMonth.of(year, month).isBefore(java.time.YearMonth.now(java.time.ZoneId.of("Asia/Kolkata")))
                ? "Ready" : "Provisional");
        response.put("additionalWorkingDaysCount", result.additionalWorkingDays());
        if (debug) {
            response.put("debugDays", result.dailyRows());
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/employees")
    public ResponseEntity<List<Map<String, Object>>> getPayrollEmployees(
            @RequestParam("clientId") Long clientId,
            @RequestParam(value = "branch", required = false) String branch) {
        List<Employee> employees = branch == null || branch.isBlank()
                ? employeeRepository.findByClientId(clientId)
                : employeeRepository.findByClientIdAndBranchIgnoreCase(clientId, branch.trim());
        List<Map<String, Object>> response = employees.stream()
                .map(employee -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", employee.getId());
                    item.put("employeeId", employee.getId());
                    item.put("employeeCode", employee.getEmployeeCode());
                    item.put("firstName", employee.getFirstName());
                    item.put("lastName", employee.getLastName());
                    item.put("branch", employee.getBranch());
                    item.put("position", employee.getPosition());
                    return item;
                })
                .sorted((left, right) -> String.valueOf(left.getOrDefault("firstName", ""))
                        .compareToIgnoreCase(String.valueOf(right.getOrDefault("firstName", ""))))
                .toList();
        return ResponseEntity.ok(response);
    }

    private int resolveShiftMinutes(String startRaw, String endRaw) {
        if (startRaw == null || endRaw == null || startRaw.isBlank() || endRaw.isBlank()) {
            return 0;
        }
        try {
            java.time.LocalTime start = java.time.LocalTime.parse(startRaw.trim());
            java.time.LocalTime end = java.time.LocalTime.parse(endRaw.trim());
            return Math.max(0, (int) java.time.Duration.between(start, end).toMinutes());
        } catch (java.time.format.DateTimeParseException ex) {
            return 0;
        }
    }

    @PostMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadPayrollLogo(
            @RequestParam("clientId") Long clientId,
            @RequestParam("logo") MultipartFile logo) {
        if (logo == null || logo.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Logo file is required"));
        }
        String contentType = logo.getContentType() == null ? "" : logo.getContentType().toLowerCase();
        if (!contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only image files are allowed"));
        }
        try {
            payrollLogoStorageService.saveLogo(clientId, logo);
            return ResponseEntity.ok(Map.of("message", "Payroll logo uploaded successfully"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload payroll logo"));
        }
    }

    @GetMapping("/logo")
    public ResponseEntity<?> getPayrollLogo(@RequestParam("clientId") Long clientId) {
        Optional<PayrollLogoStorageService.LogoData> logoOpt = payrollLogoStorageService.getLogo(clientId);
        if (logoOpt.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        PayrollLogoStorageService.LogoData logo = logoOpt.get();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        logo.contentType() == null || logo.contentType().isBlank()
                                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                                : logo.contentType()))
                .body(logo.bytes());
    }

    @PostMapping("/send-payslip")
    public ResponseEntity<?> sendPayslip(@RequestBody PayslipEmailRequest request) {
        if (request == null || request.receiver == null || request.receiver.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Receiver email is required"));
        }
        if (request.clientId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "clientId is required"));
        }
        String sender = (request.sender == null || request.sender.isBlank())
                ? "b.inba.ips444@gmail.com"
                : request.sender;
        String subject = (request.subject == null || request.subject.isBlank())
                ? "Payroll Payslip"
                : request.subject;
        String message = (request.message == null || request.message.isBlank())
                ? "Please find your payslip attached."
                : request.message;

        try {
            List<PayslipPdfService.AllowanceItem> allowanceItems = request.additionalAllowances == null
                    ? List.of()
                    : request.additionalAllowances.stream()
                            .map(item -> new PayslipPdfService.AllowanceItem(
                                    item.name == null ? "" : item.name,
                                    parseDouble(item.amount)))
                            .collect(Collectors.toList());

            PayslipPdfService.PayslipData payslipData = new PayslipPdfService.PayslipData(
                    request.companyName == null ? "ZenTime" : request.companyName,
                    request.employeeId,
                    request.employeeName,
                    request.position,
                    request.branch,
                    request.mobile,
                    request.email,
                    request.month,
                    request.year,
                    parseInt(request.totalDays),
                    parseInt(request.scheduledDays),
                    parseInt(request.weekOffDays),
                    request.holidaysSummary,
                    parseInt(request.workedDays),
                    parseInt(request.absentDays),
                    parseDouble(request.expectedHours),
                    parseDouble(request.payableHours),
                    parseDouble(request.overtimeHours),
                    parseDouble(request.missingHours),
                    parseDouble(request.basicSalary),
                    parseDouble(request.netSalary),
                    parseDouble(request.convenience),
                    parseDouble(request.otAmount),
                    parseDouble(request.pfAmount),
                    parseDouble(request.lopAmount),
                    parseDouble(request.incentives),
                    parseDouble(request.advance),
                    parseDouble(request.others),
                    parseDouble(request.allowancesTotal),
                    allowanceItems
            );

            PayrollLogoStorageService.LogoData logoData =
                    payrollLogoStorageService.getLogo(request.clientId).orElse(null);

            byte[] pdfBytes = payslipPdfService.generatePdf(payslipData, logoData);
            String monthLabel = request.month <= 0 ? "month" : String.valueOf(request.month);
            String fileName = "Payslip-" + (request.employeeId == null ? "employee" : request.employeeId)
                    + "-" + request.year + "-" + monthLabel + ".pdf";
            String result = emailService.sendEmailWithAttachment(
                    sender,
                    request.receiver,
                    subject,
                    message,
                    pdfBytes,
                    fileName,
                    "application/pdf");
            return ResponseEntity.ok(Map.of("message", result));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate/send payslip"));
        }
    }

    @PostMapping("/send-email")
    public ResponseEntity<?> sendPayrollEmail(@RequestBody EmailDetails emailDetails) {
        if (emailDetails.getReceiver() == null || emailDetails.getReceiver().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Receiver email is required"));
        }
        if (emailDetails.getSender() == null || emailDetails.getSender().isEmpty()) {
            emailDetails.setSender("b.inba.ips444@gmail.com");
        }
        String emailResponse = emailService.sendEmail(emailDetails);
        return ResponseEntity.ok(Map.of("message", emailResponse));
    }

    @PostMapping("/send-payroll-email")
    public ResponseEntity<?> sendPayrollEmailAlias(@RequestBody EmailDetails emailDetails) {
        return sendPayrollEmail(emailDetails);
    }

    private int parseInt(Number number) {
        return number == null ? 0 : number.intValue();
    }

    private List<Map<String, Object>> buildAdditionalWorkingDaysResponse(Employee employee) {
        Long employeeId = employee == null ? null : employee.getId();
        if (employeeId == null) {
            return List.of();
        }

        return additionalWorkingDayService.buildPayload(employeeId);
    }

    private String formatAdditionalWorkingDayLabel(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return "Additional Working Day";
        }
        String cleaned = rawType.trim().toLowerCase().replace("_", " ");
        String[] words = cleaned.split("\\s+");
        StringBuilder label = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            if (word.isEmpty()) {
                continue;
            }
            if (label.length() > 0) {
                label.append(" ");
            }
            label.append(Character.toUpperCase(word.charAt(0)));
            if (word.length() > 1) {
                label.append(word.substring(1));
            }
        }
        return label.toString();
    }

    private double parseDouble(Number number) {
        return number == null ? 0.0 : number.doubleValue();
    }

    public static class AllowanceRequest {
        public String name;
        public Number amount;
    }

    public static class PayslipEmailRequest {
        public Long clientId;
        public Long employeeId;
        public String companyName;
        public String sender;
        public String receiver;
        public String subject;
        public String message;
        public String employeeName;
        public String position;
        public String branch;
        public String mobile;
        public String email;
        public int month;
        public int year;
        public Number totalDays;
        public Number scheduledDays;
        public Number weekOffDays;
        public String holidaysSummary;
        public Number workedDays;
        public Number absentDays;
        public Number expectedHours;
        public Number payableHours;
        public Number overtimeHours;
        public Number missingHours;
        public Number basicSalary;
        public Number netSalary;
        public Number convenience;
        public Number otAmount;
        public Number pfAmount;
        public Number lopAmount;
        public Number incentives;
        public Number advance;
        public Number others;
        public Number allowancesTotal;
        public List<AllowanceRequest> additionalAllowances;
    }
}
