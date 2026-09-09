package com.example.demo.service;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.Holiday;
import com.example.demo.MODELS.HolidayRequest;
import com.example.demo.repo.EmployeeRepository;
import com.example.demo.repo.HolidayRepository;

@Service
public class HolidayService {
    private static final Logger logger = LoggerFactory.getLogger(HolidayService.class);

    @Autowired
    private HolidayRepository holidayRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private SchemaMaintenanceService schemaMaintenanceService;

    @Autowired
    private PushNotificationService pushNotificationService;

    public List<Holiday> getByClientId(Long clientId) {
        ensureHolidayTableExists();
        return holidayRepository.findByClientIdOrderByHolidayDateAsc(clientId);
    }

    public Holiday createHoliday(Long clientId, HolidayRequest request) {
        ensureHolidayTableExists();
        LocalDate holidayDate = parseIsoDate(request.getHolidayDate());
        String holidayName = validateHolidayName(request.getHolidayName());
        String holidayType = normalizeHolidayType(request.getHolidayType());
        String branchScope = normalizeBranchScope(request.getBranchScope());

        Optional<Holiday> existing = holidayRepository
                .findByClientIdAndHolidayDateAndBranchScopeIgnoreCase(clientId, holidayDate, branchScope);
        if (existing.isPresent()) {
            throw new IllegalStateException("Holiday already exists for this date and branch.");
        }

        Holiday holiday = new Holiday();
        holiday.setClientId(clientId);
        holiday.setHolidayDate(holidayDate);
        holiday.setHolidayName(holidayName);
        holiday.setHolidayType(holidayType);
        holiday.setBranchScope(branchScope);
        Holiday saved = holidayRepository.save(holiday);
        try {
            pushNotificationService.notifyHolidayCreated(saved);
        } catch (RuntimeException ex) {
            logger.warn("Holiday created but employee notification failed for holidayId={}, clientId={}",
                    saved.getId(), saved.getClientId(), ex);
        }
        return saved;
    }

    public Holiday updateHoliday(Long holidayId, Long clientId, HolidayRequest request) {
        ensureHolidayTableExists();
        Holiday holiday = holidayRepository.findById(holidayId)
                .orElseThrow(() -> new NoSuchElementException("Holiday not found."));

        if (!holiday.getClientId().equals(clientId)) {
            throw new IllegalArgumentException("Holiday does not belong to this client.");
        }

        LocalDate holidayDate = parseIsoDate(request.getHolidayDate());
        String holidayName = validateHolidayName(request.getHolidayName());
        String holidayType = normalizeHolidayType(request.getHolidayType());
        String branchScope = normalizeBranchScope(request.getBranchScope());

        Optional<Holiday> duplicate = holidayRepository
                .findByClientIdAndHolidayDateAndBranchScopeIgnoreCase(clientId, holidayDate, branchScope);
        if (duplicate.isPresent() && !duplicate.get().getId().equals(holidayId)) {
            throw new IllegalStateException("Holiday already exists for this date and branch.");
        }

        holiday.setHolidayDate(holidayDate);
        holiday.setHolidayName(holidayName);
        holiday.setHolidayType(holidayType);
        holiday.setBranchScope(branchScope);
        return holidayRepository.save(holiday);
    }

    public void deleteHoliday(Long holidayId, Long clientId) {
        ensureHolidayTableExists();
        Holiday holiday = holidayRepository.findById(holidayId)
                .orElseThrow(() -> new NoSuchElementException("Holiday not found."));

        if (!holiday.getClientId().equals(clientId)) {
            throw new IllegalArgumentException("Holiday does not belong to this client.");
        }
        holidayRepository.delete(holiday);
    }

    public List<Holiday> getMonthlyHolidaysForEmployee(
            Long employeeId,
            int year,
            int month,
            Long requestedClientId) {
        ensureHolidayTableExists();

        Long effectiveClientId = resolveClientId(employeeId, requestedClientId);
        try {
            LocalDate firstDate = LocalDate.of(year, month, 1);
            LocalDate lastDate = firstDate.withDayOfMonth(firstDate.lengthOfMonth());
            Employee employee = employeeRepository.findByIdAndClientId(employeeId, effectiveClientId)
                    .orElseThrow(() -> new NoSuchElementException("Employee not found for provided client."));
            String employeeBranch = normalizeBranchScope(employee.getBranch());
            return holidayRepository.findByClientIdAndHolidayDateBetweenOrderByHolidayDateAsc(
                    effectiveClientId,
                    firstDate,
                    lastDate)
                    .stream()
                    .filter(holiday -> appliesToBranch(holiday, employeeBranch))
                    .toList();
        } catch (DateTimeException ex) {
            throw new IllegalArgumentException("Invalid month or year.");
        }
    }

    private Long resolveClientId(Long employeeId, Long requestedClientId) {
        if (requestedClientId == null) {
            Employee employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new NoSuchElementException("Employee not found."));
            return employee.getClientId();
        }

        employeeRepository.findByIdAndClientId(employeeId, requestedClientId)
                .orElseThrow(() -> new NoSuchElementException("Employee not found for provided client."));
        return requestedClientId;
    }

    private LocalDate parseIsoDate(String holidayDate) {
        if (holidayDate == null || holidayDate.isBlank()) {
            throw new IllegalArgumentException("holidayDate is required.");
        }
        try {
            return LocalDate.parse(holidayDate.trim());
        } catch (DateTimeException ex) {
            throw new IllegalArgumentException("holidayDate must be in yyyy-MM-dd format.");
        }
    }

    private String validateHolidayName(String holidayName) {
        if (holidayName == null || holidayName.isBlank()) {
            throw new IllegalArgumentException("holidayName is required.");
        }
        return holidayName.trim();
    }

    private String normalizeHolidayType(String holidayType) {
        String value = holidayType == null ? "FULL" : holidayType.trim().toUpperCase();
        if (!"FULL".equals(value) && !"HALF".equals(value)) {
            throw new IllegalArgumentException("holidayType must be FULL or HALF.");
        }
        return value;
    }

    private String normalizeBranchScope(String branchScope) {
        if (branchScope == null || branchScope.isBlank()) {
            return "ALL";
        }
        String value = branchScope.trim();
        return "ALL".equalsIgnoreCase(value) || "All Branches".equalsIgnoreCase(value) ? "ALL" : value;
    }

    private boolean appliesToBranch(Holiday holiday, String employeeBranch) {
        String scope = normalizeBranchScope(holiday == null ? null : holiday.getBranchScope());
        if ("ALL".equals(scope)) {
            return true;
        }
        return !employeeBranch.isBlank()
                && scope.toLowerCase(Locale.ROOT).equals(employeeBranch.toLowerCase(Locale.ROOT));
    }

    private void ensureHolidayTableExists() {
        schemaMaintenanceService.ensureEmployeeSchema();
    }
}
