package com.example.demo.repo;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.MODELS.Holiday;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {
    Optional<Holiday> findByClientIdAndHolidayDate(Long clientId, LocalDate holidayDate);

    Optional<Holiday> findByClientIdAndHolidayDateAndBranchScopeIgnoreCase(
            Long clientId,
            LocalDate holidayDate,
            String branchScope);

    List<Holiday> findByClientIdOrderByHolidayDateAsc(Long clientId);

    List<Holiday> findByClientIdAndHolidayDateBetweenOrderByHolidayDateAsc(
            Long clientId,
            LocalDate startDate,
            LocalDate endDate);
}
