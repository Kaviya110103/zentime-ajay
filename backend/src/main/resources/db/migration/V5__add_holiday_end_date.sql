SET @holiday_end_date_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'holidays'
      AND column_name = 'holiday_end_date'
);

SET @add_holiday_end_date_sql := IF(
    @holiday_end_date_exists = 0,
    'ALTER TABLE holidays ADD COLUMN holiday_end_date DATE NULL AFTER holiday_date',
    'SELECT 1'
);
PREPARE add_holiday_end_date_statement FROM @add_holiday_end_date_sql;
EXECUTE add_holiday_end_date_statement;
DEALLOCATE PREPARE add_holiday_end_date_statement;

UPDATE holidays
SET holiday_end_date = holiday_date
WHERE holiday_end_date IS NULL;

ALTER TABLE holidays
    MODIFY COLUMN holiday_end_date DATE NOT NULL;
