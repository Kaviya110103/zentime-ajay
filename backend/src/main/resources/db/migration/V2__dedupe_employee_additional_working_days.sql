DELETE duplicate_day
FROM employee_additional_working_day duplicate_day
JOIN employee_additional_working_day latest_day
  ON latest_day.employee_id = duplicate_day.employee_id
 AND latest_day.day_type = duplicate_day.day_type
 AND latest_day.id > duplicate_day.id;

SET @index_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'employee_additional_working_day'
      AND index_name = 'uk_employee_additional_working_day_employee_type'
);

SET @create_index_sql := IF(
    @index_exists = 0,
    'CREATE UNIQUE INDEX uk_employee_additional_working_day_employee_type ON employee_additional_working_day (employee_id, day_type)',
    'SELECT 1'
);

PREPARE create_index_stmt FROM @create_index_sql;
EXECUTE create_index_stmt;
DEALLOCATE PREPARE create_index_stmt;
