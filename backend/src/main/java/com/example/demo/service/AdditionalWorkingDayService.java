package com.example.demo.service;

import com.example.demo.MODELS.AdditionalWorkingDayType;
import com.example.demo.MODELS.Employee;
import com.example.demo.MODELS.EmployeeAdditionalWorkingDay;
import com.example.demo.repo.EmployeeAdditionalWorkingDayRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdditionalWorkingDayService {
    private final EmployeeAdditionalWorkingDayRepository repository;

    public AdditionalWorkingDayService(EmployeeAdditionalWorkingDayRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public List<EmployeeAdditionalWorkingDay> replaceForEmployee(Employee employee, List<AdditionalWorkingDayInput> inputs) {
        if (employee == null || employee.getId() == null) {
            return List.of();
        }

        repository.deleteByEmployee_Id(employee.getId());
        repository.flush();
        if (employee.getAdditionalWorkingDays() == null) {
            employee.setAdditionalWorkingDays(new ArrayList<>());
        } else {
            employee.getAdditionalWorkingDays().clear();
        }

        List<EmployeeAdditionalWorkingDay> savedRows = new ArrayList<>();
        for (AdditionalWorkingDayInput input : normalizeInputs(inputs)) {
            EmployeeAdditionalWorkingDay row = new EmployeeAdditionalWorkingDay();
            row.setEmployee(employee);
            row.setDayType(input.dayType());
            row.setTimeIn(input.timeIn());
            row.setTimeOut(input.timeOut());
            EmployeeAdditionalWorkingDay saved = repository.save(row);
            employee.getAdditionalWorkingDays().add(saved);
            savedRows.add(saved);
        }
        return savedRows;
    }

    @Transactional(readOnly = true)
    public List<EmployeeAdditionalWorkingDay> findUniqueEntities(Long employeeId) {
        if (employeeId == null) {
            return List.of();
        }
        List<EmployeeAdditionalWorkingDay> rows = repository.findByEmployee_IdOrderByIdDesc(employeeId);
        Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> latestByType = new EnumMap<>(AdditionalWorkingDayType.class);
        for (EmployeeAdditionalWorkingDay row : rows) {
            if (row == null || row.getDayType() == null) {
                continue;
            }
            latestByType.putIfAbsent(row.getDayType(), row);
        }
        return latestByType.values().stream()
                .sorted(Comparator.comparing(row -> row.getDayType().ordinal()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<Long, List<EmployeeAdditionalWorkingDay>> findUniqueEntitiesByEmployeeIds(Collection<Long> employeeIds) {
        if (employeeIds == null || employeeIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay>> latestByEmployee = new HashMap<>();
        for (EmployeeAdditionalWorkingDayRepository.AdditionalWorkingDayBatchRaw row : repository.findRawByEmployeeIds(employeeIds)) {
            AdditionalWorkingDayType dayType = parseType(row == null ? null : row.getDayType());
            Long employeeId = row == null ? null : row.getEmployeeId();
            if (dayType == null || employeeId == null) {
                continue;
            }
            Employee employee = new Employee();
            employee.setId(employeeId);
            EmployeeAdditionalWorkingDay day = new EmployeeAdditionalWorkingDay();
            day.setEmployee(employee);
            day.setDayType(dayType);
            day.setTimeIn(row.getTimeIn());
            day.setTimeOut(row.getTimeOut());
            latestByEmployee
                    .computeIfAbsent(employeeId, ignored -> new EnumMap<>(AdditionalWorkingDayType.class))
                    .putIfAbsent(dayType, day);
        }

        Map<Long, List<EmployeeAdditionalWorkingDay>> result = new HashMap<>();
        latestByEmployee.forEach((employeeId, latestByType) -> result.put(
                employeeId,
                latestByType.values().stream()
                        .sorted(Comparator.comparing(row -> row.getDayType().ordinal()))
                        .toList()));
        return result;
    }

    @Transactional
    public List<Map<String, Object>> buildPayload(Long employeeId) {
        removePersistedDuplicates(employeeId);
        return findUniqueEntities(employeeId).stream()
                .map(this::toPayload)
                .toList();
    }

    @Transactional
    public void removePersistedDuplicates(Long employeeId) {
        if (employeeId == null) {
            return;
        }
        List<EmployeeAdditionalWorkingDay> rows = repository.findByEmployee_IdOrderByIdDesc(employeeId);
        Map<AdditionalWorkingDayType, EmployeeAdditionalWorkingDay> latestByType = new EnumMap<>(AdditionalWorkingDayType.class);
        List<EmployeeAdditionalWorkingDay> duplicateRows = new ArrayList<>();
        for (EmployeeAdditionalWorkingDay row : rows) {
            if (row == null || row.getDayType() == null) {
                continue;
            }
            EmployeeAdditionalWorkingDay existing = latestByType.putIfAbsent(row.getDayType(), row);
            if (existing != null) {
                duplicateRows.add(row);
            }
        }
        if (!duplicateRows.isEmpty()) {
            repository.deleteAllInBatch(duplicateRows);
        }
    }

    public List<AdditionalWorkingDayInput> normalizeInputs(List<AdditionalWorkingDayInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return List.of();
        }
        Map<AdditionalWorkingDayType, AdditionalWorkingDayInput> unique = new EnumMap<>(AdditionalWorkingDayType.class);
        for (AdditionalWorkingDayInput input : inputs) {
            if (input == null || input.dayType() == null) {
                continue;
            }
            unique.put(input.dayType(), new AdditionalWorkingDayInput(
                    input.dayType(),
                    clean(input.timeIn()),
                    clean(input.timeOut())));
        }
        return unique.values().stream()
                .sorted(Comparator.comparing(input -> input.dayType().ordinal()))
                .toList();
    }

    public AdditionalWorkingDayType parseType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return null;
        }
        String normalized = rawType.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        try {
            return AdditionalWorkingDayType.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public String formatLabel(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return "Additional Working Day";
        }
        String cleaned = rawType.trim().toLowerCase().replace("_", " ");
        String[] words = cleaned.split("\\s+");
        StringBuilder label = new StringBuilder();
        for (String word : words) {
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

    private Map<String, Object> toPayload(EmployeeAdditionalWorkingDay day) {
        Map<String, Object> item = new LinkedHashMap<>();
        String rawType = day.getDayType() == null ? "" : day.getDayType().name();
        item.put("dayType", rawType);
        item.put("label", formatLabel(rawType));
        item.put("timeIn", day.getTimeIn());
        item.put("timeOut", day.getTimeOut());
        return item;
    }

    private String clean(String value) {
        return value == null ? null : value.trim();
    }

    public record AdditionalWorkingDayInput(
            AdditionalWorkingDayType dayType,
            String timeIn,
            String timeOut) {
    }
}
