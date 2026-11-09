CREATE TABLE IF NOT EXISTS missed_timeout_submission (
    id BIGINT NOT NULL AUTO_INCREMENT,
    employee_id BIGINT NOT NULL,
    attendance_record_id BIGINT NOT NULL,
    attendance_date DATE NOT NULL,
    reason VARCHAR(500) NOT NULL,
    clock_out_time TIME NOT NULL,
    submitted_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_missed_timeout_submission_record (attendance_record_id),
    KEY idx_missed_timeout_submission_employee_month (employee_id, submitted_at),
    CONSTRAINT fk_missed_timeout_submission_employee
        FOREIGN KEY (employee_id) REFERENCES employee(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_missed_timeout_submission_record
        FOREIGN KEY (attendance_record_id) REFERENCES attendance_record(id)
        ON DELETE CASCADE
);
