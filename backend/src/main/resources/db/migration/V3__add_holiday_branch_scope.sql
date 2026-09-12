SET @holiday_branch_column_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'holidays'
      AND column_name = 'branch_scope'
);

SET @add_holiday_branch_column_sql := IF(
    @holiday_branch_column_exists = 0,
    'ALTER TABLE holidays ADD COLUMN branch_scope VARCHAR(255) NOT NULL DEFAULT ''ALL''',
    'SELECT 1'
);

PREPARE add_holiday_branch_column_stmt FROM @add_holiday_branch_column_sql;
EXECUTE add_holiday_branch_column_stmt;
DEALLOCATE PREPARE add_holiday_branch_column_stmt;

UPDATE holidays
SET branch_scope = 'ALL'
WHERE branch_scope IS NULL OR TRIM(branch_scope) = '';

SET @old_holiday_index_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'holidays'
      AND index_name = 'uk_holidays_client_date'
);

SET @drop_old_holiday_index_sql := IF(
    @old_holiday_index_exists = 0,
    'SELECT 1',
    'ALTER TABLE holidays DROP INDEX uk_holidays_client_date'
);

PREPARE drop_old_holiday_index_stmt FROM @drop_old_holiday_index_sql;
EXECUTE drop_old_holiday_index_stmt;
DEALLOCATE PREPARE drop_old_holiday_index_stmt;

SET @new_holiday_index_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'holidays'
      AND index_name = 'uk_holidays_client_date_branch'
);

SET @create_holiday_index_sql := IF(
    @new_holiday_index_exists = 0,
    'CREATE UNIQUE INDEX uk_holidays_client_date_branch ON holidays (client_id, holiday_date, branch_scope)',
    'SELECT 1'
);

PREPARE create_holiday_index_stmt FROM @create_holiday_index_sql;
EXECUTE create_holiday_index_stmt;
DEALLOCATE PREPARE create_holiday_index_stmt;
