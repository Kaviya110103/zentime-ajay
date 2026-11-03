import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Select, Space, Table, Tag, Typography, message } from "antd";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  UserOutlined,
} from "@ant-design/icons";
import axios from "axios";
import moment from "moment";
import { API_BASE_URL, API_REQUEST_TIMEOUT_MS } from "../config/api";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";

const { Title, Text } = Typography;
const client = JSON.parse(localStorage.getItem("loggedInClient"));

const formatDate = (value) => {
  const parsed = moment(value, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  return parsed.isValid() ? parsed.format("DD MMM YYYY") : "-";
};

const formatTime = (value) => {
  const parsed = moment(value, ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed.format("hh:mm A") : "-";
};

const MissedTimeoutPage = () => {
  const [records, setRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "10000" });
      if (client?.id) params.set("clientId", client.id);
      if (branchFilter !== "all") params.set("branch", branchFilter);

      const response = await axios.get(
        `${API_BASE_URL}/api/attendance/missed-timeout/submissions?${params.toString()}`,
        { timeout: API_REQUEST_TIMEOUT_MS }
      );
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load clock-out request report:", error);
      message.error("Unable to load clock-out request report");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [branchFilter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let active = true;

    const loadBranches = async () => {
      if (!client?.id) return;
      try {
        const names = await fetchBranchesFromLocationSet(client.id);
        if (active) setBranches(names);
      } catch (error) {
        console.error("Failed to load branches:", error);
        if (active) setBranches([]);
      }
    };

    loadBranches();
    return () => {
      active = false;
    };
  }, []);

  const employeeOptions = useMemo(() => {
    const employees = new Map();
    records.forEach((record) => {
      const name =
        `${record.firstName || ""} ${record.lastName || ""}`.trim() ||
        "Unnamed employee";
      employees.set(String(record.employeeId), name);
    });
    return Array.from(employees, ([value, label]) => ({ value, label }));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (employeeFilter === "all") return records;
    return records.filter((record) => String(record.employeeId) === employeeFilter);
  }, [employeeFilter, records]);

  useEffect(() => {
    if (
      employeeFilter !== "all" &&
      !employeeOptions.some((option) => option.value === employeeFilter)
    ) {
      setEmployeeFilter("all");
    }
  }, [employeeFilter, employeeOptions]);

  const columns = [
    {
      title: "Employee",
      key: "employee",
      width: 220,
      fixed: "left",
      render: (_, record) => (
        <div>
          <Text strong>
            {`${record.firstName || ""} ${record.lastName || ""}`.trim() ||
              "Unnamed employee"}
          </Text>
          <div className="clockout-muted">{record.mobile || "No mobile number"}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      dataIndex: "branch",
      width: 160,
      render: (value) => value || "-",
    },
    {
      title: "Position",
      dataIndex: "position",
      width: 170,
      render: (value) => value || "-",
    },
    {
      title: "Attendance Date",
      dataIndex: "attendanceDate",
      width: 170,
      sorter: (left, right) =>
        moment(left.attendanceDate).valueOf() - moment(right.attendanceDate).valueOf(),
      render: (value) => (
        <Space size={6}>
          <CalendarOutlined className="clockout-accent" />
          {formatDate(value)}
        </Space>
      ),
    },
    {
      title: "Submitted Clock-Out",
      dataIndex: "clockOutTime",
      width: 190,
      render: (value) => (
        <Tag color="purple" icon={<ClockCircleOutlined />} className="clockout-time-value">
          {formatTime(value)}
        </Tag>
      ),
    },
    {
      title: "Employee Reason",
      dataIndex: "reason",
      width: 380,
      render: (value) => (
        <div className="clockout-reason">{value || "No reason provided"}</div>
      ),
    },
  ];

  return (
    <div className="clockout-page">
      <section className="clockout-header">
        <div>
          <Title level={3}>Clock-Out Request Report</Title>
          <Text>Pending requests and submitted clock-out history in one report.</Text>
        </div>
      </section>

      <section className="clockout-toolbar">
        <Space wrap size={12}>
          <Select
            value={branchFilter}
            onChange={setBranchFilter}
            style={{ width: 210 }}
            suffixIcon={<FilterOutlined />}
            options={[
              { value: "all", label: "All branches" },
              ...branches.map((branch) => ({ value: branch, label: branch })),
            ]}
          />
          <Select
            showSearch
            optionFilterProp="label"
            value={employeeFilter}
            onChange={setEmployeeFilter}
            style={{ width: 250 }}
            suffixIcon={<UserOutlined />}
            options={[
              { value: "all", label: "All employees" },
              ...employeeOptions,
            ]}
          />
        </Space>
      </section>

      <Card className="clockout-table-card" bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="submissionId"
          loading={loading}
          pagination={false}
          scroll={{ x: 1490, y: "calc(100vh - 245px)" }}
          locale={{ emptyText: "No clock-out requests found" }}
        />
      </Card>

      <style>{`
        .clockout-page { min-height: 100vh; background: #f5f5f5; overflow: auto; }
        .clockout-header { background: #351153; color: #fff; padding: 18px 20px; }
        .clockout-header .ant-typography { color: #fff; margin: 0; }
        .clockout-toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 16px; padding: 14px 18px; background: #fff; border-bottom: 1px solid #ececec; }
        .clockout-table-card { border-radius: 0; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08); }
        .clockout-table-card .ant-table-thead > tr > th { background: #351153; color: #fff; font-weight: 700; white-space: nowrap; }
        .clockout-table-card .ant-table-tbody > tr > td { vertical-align: top; }
        .clockout-table-card .ant-table-tbody > tr:hover > td { background: #faf7fd; }
        .clockout-muted { color: #6b7280; font-size: 12px; margin-top: 2px; }
        .clockout-reason { white-space: normal; line-height: 1.55; color: #263238; min-width: 280px; }
        .clockout-accent { color: #5b2184; }
        .clockout-time-value { font-weight: 700; font-size: 14px; padding: 4px 9px; }
        @media (max-width: 760px) { .clockout-toolbar { align-items: flex-start; flex-direction: column; } }
      `}</style>
    </div>
  );
};

export default MissedTimeoutPage;
