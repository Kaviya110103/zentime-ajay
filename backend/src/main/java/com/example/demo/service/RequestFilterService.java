package com.example.demo.service;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class RequestFilterService {
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ISO_LOCAL_DATE
    );

    public String normalizeBranch(String branch) {
        if (branch == null || branch.isBlank()) {
            return null;
        }
        return branch.trim().toLowerCase(Locale.ROOT);
    }

    public boolean matchesMonth(String rawDate, Integer month, Integer year) {
        Optional<YearMonth> target = resolveYearMonth(month, year);
        if (target.isEmpty()) {
            return true;
        }
        return parseDate(rawDate)
                .map(date -> YearMonth.from(date).equals(target.get()))
                .orElse(false);
    }

    public boolean matchesMonth(LocalDate date, Integer month, Integer year) {
        Optional<YearMonth> target = resolveYearMonth(month, year);
        if (target.isEmpty()) {
            return true;
        }
        return date != null && YearMonth.from(date).equals(target.get());
    }

    public boolean matchesMonth(LocalDateTime dateTime, Integer month, Integer year) {
        return dateTime == null
                ? resolveYearMonth(month, year).isEmpty()
                : matchesMonth(dateTime.toLocalDate(), month, year);
    }

    public boolean rangeOverlapsMonth(String startRaw, String endRaw, Integer month, Integer year) {
        Optional<YearMonth> target = resolveYearMonth(month, year);
        if (target.isEmpty()) {
            return true;
        }
        Optional<LocalDate> startOpt = parseDate(startRaw);
        Optional<LocalDate> endOpt = parseDate(endRaw);
        if (startOpt.isEmpty() && endOpt.isEmpty()) {
            return false;
        }
        LocalDate start = startOpt.orElse(endOpt.get());
        LocalDate end = endOpt.orElse(start);
        if (end.isBefore(start)) {
            LocalDate swap = start;
            start = end;
            end = swap;
        }
        LocalDate monthStart = target.get().atDay(1);
        LocalDate monthEnd = target.get().atEndOfMonth();
        return !start.isAfter(monthEnd) && !end.isBefore(monthStart);
    }

    private Optional<YearMonth> resolveYearMonth(Integer month, Integer year) {
        if (month == null || year == null) {
            return Optional.empty();
        }
        if (month < 1 || month > 12 || year < 1900 || year > 3000) {
            return Optional.empty();
        }
        return Optional.of(YearMonth.of(year, month));
    }

    private Optional<LocalDate> parseDate(String rawDate) {
        if (rawDate == null || rawDate.isBlank()) {
            return Optional.empty();
        }
        String value = rawDate.trim();
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return Optional.of(LocalDate.parse(value, formatter));
            } catch (DateTimeParseException ignored) {
            }
        }
        return Optional.empty();
    }
}
