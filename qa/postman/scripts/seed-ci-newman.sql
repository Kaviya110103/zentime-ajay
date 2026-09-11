CREATE DATABASE IF NOT EXISTS zentime_ci;
USE zentime_ci;

DELETE FROM clients WHERE id IN (1, 2);
DELETE FROM employee WHERE id IN (1, 2, 3);

INSERT INTO clients (
  id,
  client_name,
  company_name,
  company_code,
  mobile_number,
  email_address,
  address,
  pincode,
  city,
  state,
  country,
  employee_count,
  registered_date,
  working_hours,
  username,
  password,
  tenant_db_name,
  provisioning_status
) VALUES
  (
    1,
    'QA Client One',
    'QA Company One',
    'QA001',
    '9999999999',
    'qa001@example.test',
    'Local CI QA',
    '600001',
    'Chennai',
    'Tamil Nadu',
    'India',
    10,
    '2026-09-01',
    '8',
    'qaadmin',
    '__QA_ADMIN_PASSWORD__',
    'tenant_qa001',
    'ACTIVE'
  ),
  (
    2,
    'QA Client Two',
    'QA Company Two',
    'QA002',
    '8888888888',
    'qa002@example.test',
    'Local CI QA',
    '600002',
    'Chennai',
    'Tamil Nadu',
    'India',
    10,
    '2026-09-01',
    '8',
    'qaadmin2',
    '__QA_ADMIN_PASSWORD__',
    'tenant_qa002',
    'ACTIVE'
  );

DROP DATABASE IF EXISTS tenant_qa001;
DROP DATABASE IF EXISTS tenant_qa002;
CREATE DATABASE tenant_qa001;
CREATE DATABASE tenant_qa002;

CREATE TABLE tenant_qa001.employee LIKE zentime_ci.employee;
CREATE TABLE tenant_qa001.attendance_record LIKE zentime_ci.attendance_record;
CREATE TABLE tenant_qa001.leave_permission LIKE zentime_ci.leave_permission;
CREATE TABLE tenant_qa001.employee_additional_working_day LIKE zentime_ci.employee_additional_working_day;
CREATE TABLE tenant_qa001.employee_push_tokens LIKE zentime_ci.employee_push_tokens;
CREATE TABLE tenant_qa001.holidays LIKE zentime_ci.holidays;

CREATE TABLE tenant_qa002.employee LIKE zentime_ci.employee;
CREATE TABLE tenant_qa002.attendance_record LIKE zentime_ci.attendance_record;
CREATE TABLE tenant_qa002.leave_permission LIKE zentime_ci.leave_permission;
CREATE TABLE tenant_qa002.employee_additional_working_day LIKE zentime_ci.employee_additional_working_day;
CREATE TABLE tenant_qa002.employee_push_tokens LIKE zentime_ci.employee_push_tokens;
CREATE TABLE tenant_qa002.holidays LIKE zentime_ci.holidays;

INSERT INTO tenant_qa001.employee (
  id,
  first_name,
  last_name,
  mobile,
  gender,
  position,
  branch,
  username,
  password,
  dob,
  email_id,
  address,
  alternative_mobile,
  date_of_joining,
  salary,
  week_off,
  shift_start_time,
  shift_end_time,
  shift_start,
  shift_end,
  leave_policy_type,
  casual_leave_balance,
  permission_allowance_per_month,
  permission_hours_allowed,
  additional_working_days,
  company_code,
  employee_code,
  client_id
) VALUES
  (
    1,
    'QA',
    'Employee',
    '9999999999',
    'Other',
    'QA Tester',
    'QA Branch',
    'qa.employee',
    '__QA_EMPLOYEE_PASSWORD__',
    '2000-01-01',
    'qa.employee@example.test',
    'Local CI QA',
    '9999999998',
    '2026-09-01',
    30000,
    'Sunday',
    '09:00',
    '18:00',
    '09:00',
    '18:00',
    'Standard',
    12,
    2,
    2,
    NULL,
    'QA001',
    'QA001.EMP1',
    1
  ),
  (
    2,
    'QA',
    'No Time In',
    '9999999997',
    'Other',
    'QA Tester',
    'QA Branch',
    'qa.no-timein',
    '__QA_EMPLOYEE_PASSWORD__',
    '2000-01-02',
    'qa.no-timein@example.test',
    'Local CI QA',
    '9999999996',
    '2026-09-01',
    30000,
    'Sunday',
    '09:00',
    '18:00',
    '09:00',
    '18:00',
    'Standard',
    12,
    2,
    2,
    NULL,
    'QA001',
    'QA001.EMP2',
    1
  );

INSERT INTO tenant_qa002.employee (
  id,
  first_name,
  last_name,
  mobile,
  gender,
  position,
  branch,
  username,
  password,
  dob,
  email_id,
  address,
  alternative_mobile,
  date_of_joining,
  salary,
  week_off,
  shift_start_time,
  shift_end_time,
  shift_start,
  shift_end,
  leave_policy_type,
  casual_leave_balance,
  permission_allowance_per_month,
  permission_hours_allowed,
  additional_working_days,
  company_code,
  employee_code,
  client_id
) VALUES
  (
    3,
    'QA2',
    'Employee',
    '8888888887',
    'Other',
    'QA Tester',
    'QA2 Branch',
    'qa2.employee',
    '__QA_EMPLOYEE_PASSWORD__',
    '2000-01-03',
    'qa2.employee@example.test',
    'Local CI QA',
    '8888888886',
    '2026-09-01',
    30000,
    'Sunday',
    '09:00',
    '18:00',
    '09:00',
    '18:00',
    'Standard',
    12,
    2,
    2,
    NULL,
    'QA002',
    'QA002.EMP3',
    2
  );

INSERT INTO tenant_qa001.attendance_record (
  id,
  employee_id,
  date,
  attendance_status,
  day_status,
  location,
  time_in,
  time_out,
  worked_hours,
  missed_times,
  expected_shift_start,
  expected_shift_end,
  expected_minutes,
  shift_source,
  overtime_approved,
  overtime_requested
) VALUES
  (
    1,
    1,
    '09/09/2026',
    'Present',
    NULL,
    'QA Office',
    NULL,
    NULL,
    NULL,
    NULL,
    '09:00',
    '18:00',
    540,
    'employee',
    0,
    0
  ),
  (
    2,
    2,
    '09/09/2026',
    'Present',
    NULL,
    'QA Office',
    NULL,
    NULL,
    NULL,
    NULL,
    '09:00',
    '18:00',
    540,
    'employee',
    0,
    0
  );
