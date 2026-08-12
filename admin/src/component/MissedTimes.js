import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  DatePicker,
  TimePicker,
  message,
  Tag,
  Card,
  Select,
  Typography,
  Statistic,
  Space,
  Popconfirm,
} from "antd";
import {
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  FilterOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import moment from "moment";
import axios from "axios";
import { API_BASE_URL, API_REQUEST_TIMEOUT_MS } from "../config/api";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";

const { Option } = Select;
const { Title, Text } = Typography;

// Custom styles based on design requirements
const styles = {
  container: {
    padding: "0px",
    backgroundColor: "#F5F5F5",
    minHeight: "100vh",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#351153",
    color: "white",
    padding: "16px",
    borderRadius: "12px 12px 0 0",
    boxShadow: "0 3px 5px rgba(0,0,0,0.2)",
  },
  title: {
    color: "white",
    fontSize: "1.3rem",
    margin: 0,
    fontFamily: "Montserrat, sans-serif",
    fontWeight: "bold",
  },
  filtersContainer: {
    backgroundColor: "white",
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsContainer: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
  },
  statCard: {
    backgroundColor: "white",
    padding: "12px 20px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    minWidth: "150px",
  },
  employeeInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  employeeName: {
    fontWeight: 500,
    fontFamily: "Open Sans, sans-serif",
    color: "#212121",
  },
  employeeMobile: {
    fontSize: "12px",
    color: "#757575",
    fontFamily: "Open Sans, sans-serif",
  },
  reasonCell: {
    maxWidth: "200px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontFamily: "Open Sans, sans-serif",
    textAlign: "center",
  },
  timeoutNote: {
    backgroundColor: "#FAFAFA",
    padding: "12px",
    borderRadius: "12px",
    marginTop: "16px",
    color: "#757575",
    fontFamily: "Open Sans, sans-serif",
  },
  errorMessage: {
    color: "#F44336",
    marginBottom: "16px",
    fontFamily: "Open Sans, sans-serif",
  },
  tableCard: {
    borderRadius: "0 0 12px 12px",
    boxShadow: "0 3px 6px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
  },
  modalHeader: {
    color: "#351153",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: "bold",
  },
  tableCell: {
    padding: "12px 16px",
    fontFamily: "Open Sans, sans-serif",
    textAlign: "center",
  },
  actionButton: {
    backgroundColor: "#351153",
    borderColor: "#351153",
    fontFamily: "Open Sans, sans-serif",
  },
  statusContainer: {
    display: "flex",
    justifyContent: "center",
  },
  filterButton: {
    marginLeft: "8px",
  },
  branchFilterSelect: {
    minWidth: "220px",
    height: "32px",
    padding: "4px 12px",
    borderRadius: "8px",
    border: "1px solid #d9d9d9",
    backgroundColor: "#fff",
    fontFamily: "Open Sans, sans-serif",
    color: "#212121",
    outline: "none",
  },
  countBadge: {
    backgroundColor: "#FF4D4F",
    color: "white",
    borderRadius: "10px",
    padding: "2px 8px",
    fontSize: "12px",
    marginLeft: "8px",
  },
};

const client = JSON.parse(localStorage.getItem("loggedInClient"));

const MissedTimeoutPage = () => {
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [currentDateTime, setCurrentDateTime] = useState(moment());
  const [statusFilter, setStatusFilter] = useState("pending");
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState([]);
  const [pendingData, setPendingData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
  });

  const getViewData = (type, pendingList, completedList) => {
    if (type === "completed") return completedList;
    return pendingList;
  };

  const buildAttendanceUrl = (path) => {
    const params = new URLSearchParams({ limit: "200" });
    if (client?.id) {
      params.set("clientId", client.id);
    }
    if (branchFilter !== "all") {
      params.set("branch", branchFilter);
    }
    const query = `?${params.toString()}`;
    return `${API_BASE_URL}/api/attendance/${path}${query}`;
  };

  const filterToRecentMonth = (items) => {
    const cutoff = moment().subtract(1, "month").startOf("day");
    return items.filter((item) => {
      const recordDate = moment(item.date, "DD/MM/YYYY");
      return recordDate.isSameOrAfter(cutoff, "day");
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setCurrentDateTime(moment());
    }, 60000);
    return () => clearInterval(interval);
  }, [branchFilter]);

  useEffect(() => {
    let active = true;

    const fetchBranches = async () => {
      if (!client?.id) {
        if (active) setBranches([]);
        return;
      }
      try {
        const names = await fetchBranchesFromLocationSet(client.id);
        if (active) setBranches(names);
      } catch (error) {
        console.error("Failed to fetch branches from Location Set:", error);
        if (active) setBranches([]);
      }
    };

    fetchBranches();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const activeData = getViewData(statusFilter, pendingData, completedData);
    setFilteredData(activeData);
    setStats({
      total: activeData.length,
    });
  }, [statusFilter, pendingData, completedData]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingResult, completedResult] = await Promise.allSettled([
        axios.get(buildAttendanceUrl("missed-timeout"), { timeout: API_REQUEST_TIMEOUT_MS }),
        axios.get(buildAttendanceUrl("completed-missed-timeout"), { timeout: API_REQUEST_TIMEOUT_MS }),
      ]);

      if (completedResult.status === "rejected") {
        console.warn(
          "Completed missed-timeout endpoint unavailable:",
          completedResult.reason
        );
      }

      if (pendingResult.status === "rejected") {
        console.warn("Pending missed-timeout endpoint unavailable:", pendingResult.reason);
      }

      const recentPending = filterToRecentMonth(
        pendingResult.status === "fulfilled" && Array.isArray(pendingResult.value.data)
          ? pendingResult.value.data
          : []
      );
      const recentCompleted = filterToRecentMonth(
        completedResult.status === "fulfilled" && Array.isArray(completedResult.value.data)
          ? completedResult.value.data
          : []
      );

      const sortByDateDesc = (items) => items.sort((a, b) => {
        const dateA = moment(a.date, "DD/MM/YYYY");
        const dateB = moment(b.date, "DD/MM/YYYY");
        return dateB - dateA;
      });

      const sortedPending = sortByDateDesc([...recentPending]);
      const sortedCompleted = sortByDateDesc([...recentCompleted]);
      setPendingData(sortedPending);
      setCompletedData(sortedCompleted);
    } catch (error) {
      message.error("Failed to fetch data");
      console.error("Error fetching missed timeout data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
  };

  const handleCompleteTimeout = (record) => {
    const recordDate = moment(record.date, "DD/MM/YYYY");
    const today = moment().startOf("day");

    if (recordDate.isSame(today, "day")) {
      message.error(
        "Cannot complete timeout for current date. Please wait until tomorrow."
      );
      return;
    }

    setSelectedRecord(record);
    form.setFieldsValue({
      date: recordDate,
      time: currentDateTime,
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedDate = moment(values.date);
      const today = moment().startOf("day");

      if (selectedDate.isSame(today, "day")) {
        message.error(
          "Cannot complete timeout for current date. Please wait until tomorrow."
        );
        return;
      }

      const dateTime = moment(values.date)
        .hour(values.time.hour())
        .minute(values.time.minute())
        .second(values.time.second())
        .format("YYYY-MM-DDTHH:mm:ss");

      await axios.put(
        `${API_BASE_URL}/api/attendance/complete-missed-timeout`,
        null,
        {
          params: {
            attendanceId: selectedRecord.attendanceId,
            timeOut: dateTime,
            missedTimes: selectedRecord.missedTimes || 1,
          },
        }
      );

      message.success("Timeout completed successfully");
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      message.error("Failed to complete timeout");
      console.error("Error completing timeout:", error);
    }
  };

  const handleDeleteCompleted = async (record) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/attendance/completed-missed-timeout/${record.attendanceId}`,
        {
          params: { clientId: client?.id },
        }
      );
      message.success("Completed clockout request deleted successfully");
      fetchData();
    } catch (error) {
      message.error("Failed to delete completed clockout request");
      console.error("Error deleting completed clockout request:", error);
    }
  };

  const handleDeleteAllCompleted = async () => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/attendance/completed-missed-timeout`,
        { params: { clientId: client?.id } }
      );
      const deletedCount = response?.data?.deletedCount ?? 0;
      message.success(
        deletedCount > 0
          ? `${deletedCount} completed requests deleted successfully`
          : "No completed requests found to delete"
      );
      fetchData();
    } catch (error) {
      message.error("Failed to delete completed requests");
      console.error("Error deleting all completed requests:", error);
    }
  };

  const columns = [
    {
      title: "Employee",
      dataIndex: "firstName",
      key: "firstName",
      width: 200,
      fixed: "left",
      align: "center",
      render: (text, record) => (
        <div style={styles.employeeInfo}>
          <div style={styles.employeeName}>{text}</div>
          <div style={styles.employeeMobile}>{record.mobile}</div>
        </div>
      ),
    },
    {
      title: "Position",
      dataIndex: "position",
      key: "position",
      width: 150,
      align: "center",
      render: (text) => <div style={styles.tableCell}>{text}</div>,
    },
    {
      title: "Branch",
      dataIndex: "branch",
      key: "branch",
      width: 150,
      align: "center",
      render: (text) => <div style={styles.tableCell}>{text}</div>,
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 150,
      align: "center",
      defaultSortOrder: "descend",
      sorter: (a, b) => {
        const dateA = moment(a.date, "DD/MM/YYYY");
        const dateB = moment(b.date, "DD/MM/YYYY");
        return dateA - dateB;
      },
      render: (text) => {
        const recordDate = moment(text, "DD/MM/YYYY");
        const today = moment().startOf("day");
        const isToday = recordDate.isSame(today, "day");
        
        return (
          <div style={styles.tableCell}>
            {recordDate.format("DD MMM YYYY")}
            {isToday && (
              <Tag color="blue" style={{ marginLeft: "8px" }}>
                Today
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Reason",
      dataIndex: "timeoutReason",
      key: "reason",
      width: 200,
      align: "center",
      render: (reason) => (
        <div
          style={{ ...styles.reasonCell, ...styles.tableCell }}
          title={reason}
        >
          {reason || "Not specified"}
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 200,
      align: "center",
      render: (_, record) => {
        const isCompleted = String(record?.status || "").toUpperCase() === "COMPLETED";
        if (isCompleted) {
          return (
            <div style={styles.statusContainer}>
              <Tag color="success" icon={<CheckOutlined />}>
                Completed
              </Tag>
            </div>
          );
        }

        const recordDate = moment(record.date, "DD/MM/YYYY");
        const today = moment().startOf("day");
        const isToday = recordDate.isSame(today, "day");

        return (
          <div style={styles.statusContainer}>
            <Tag
              icon={
                isToday ? (
                  <CloseOutlined />
                ) : (
                  <ClockCircleOutlined />
                )
              }
              color={isToday ? "error" : "warning"}
            >
              {isToday
                ? "Cannot complete today"
                : "Missed Timeout"}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "Action",
      key: "action",
      width: 180,
      fixed: "right",
      align: "center",
      render: (_, record) => {
        const isCompleted = String(record?.status || "").toUpperCase() === "COMPLETED";
        if (isCompleted) {
          return (
            <div style={styles.tableCell}>
              <Popconfirm
                title="Delete completed request"
                description="Are you sure you want to delete this completed clockout request?"
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDeleteCompleted(record)}
              >
                <Button danger icon={<DeleteOutlined />} size="small">
                  Delete
                </Button>
              </Popconfirm>
            </div>
          );
        }

        const recordDate = moment(record.date, "DD/MM/YYYY");
        const today = moment().startOf("day");
        const isToday = recordDate.isSame(today, "day");

        return (
          <div style={styles.tableCell}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleCompleteTimeout(record)}
              disabled={isToday}
              style={styles.actionButton}
              size="small"
            >
              Complete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Title level={3} style={styles.title}>
          Missed Timeout Requests
          {stats.total > 0 && (
            <span style={styles.countBadge}>{stats.total}</span>
          )}
        </Title>
      </div>

      <div style={styles.filtersContainer}>
        <div style={styles.statsContainer}>
          <div style={styles.statCard}>
            <Statistic
              title="Total Requests"
              value={stats.total}
              valueStyle={{ color: "#351153" }}
            />
          </div>
        </div>

        <Space wrap>
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            style={styles.branchFilterSelect}
          >
            <option value="all">All Branches</option>
            {branches.map((branchName, index) => (
              <option key={index} value={branchName}>
                {branchName}
              </option>
            ))}
          </select>

          <Select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            style={{ width: 220, minWidth: 220, flex: "0 0 220px" }}
            suffixIcon={<FilterOutlined />}
            placeholder="Status"
          >
            <Option value="pending">Pending Requests</Option>
            <Option value="completed">Completed Requests</Option>
          </Select>

          {statusFilter === "completed" && filteredData.length > 0 && (
            <Popconfirm
              title="Delete all completed requests"
              description="Are you sure you want to delete all completed clockout requests?"
              okText="Delete All"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              onConfirm={handleDeleteAllCompleted}
            >
              <Button danger icon={<DeleteOutlined />}>
                Delete All Completed
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Card style={styles.tableCard} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="attendanceId"
          loading={loading}
          pagination={{
            pageSize: 20, // Increased from 10 to show more records
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `Showing ${range[0]}-${range[1]} of ${total} records`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ 
            x: 1200, 
            y: "calc(100vh - 280px)" // Adjusted height for stats panel
          }}
          bordered
          size="middle"
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <Text strong>Total Displayed:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Text strong>{filteredData.length}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={4}>
                  <Text type="secondary">
                    {statusFilter === "completed"
                      ? "Showing completed clockout requests"
                      : "Showing pending clockout requests"}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      <Modal
        title={
          <span style={styles.modalHeader}>
            Complete Timeout for {selectedRecord?.firstName}
          </span>
        }
        visible={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        okText="Submit Timeout"
        cancelText="Cancel"
        okButtonProps={{
          style: styles.actionButton,
        }}
        cancelButtonProps={{
          style: { fontFamily: "Open Sans, sans-serif" },
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={
              <span style={{ fontFamily: "Open Sans, sans-serif" }}>Date</span>
            }
            name="date"
            rules={[{ required: true, message: "Please select date" }]}
          >
            <DatePicker style={{ width: "100%" }} disabled />
          </Form.Item>
          <Form.Item
            label={
              <span style={{ fontFamily: "Open Sans, sans-serif" }}>
                Timeout Time
              </span>
            }
            name="time"
            rules={[{ required: true, message: "Please select time" }]}
          >
            <TimePicker
              style={{ width: "100%" }}
              format="hh:mm A"
              showNow={false}
              defaultOpenValue={moment().subtract(1, "hours")}
            />
          </Form.Item>
          {selectedRecord?.timeoutReason && (
            <Form.Item
              label={
                <span style={{ fontFamily: "Open Sans, sans-serif" }}>
                  Reason for missed timeout
                </span>
              }
            >
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "#FAFAFA",
                  borderRadius: "8px",
                }}
              >
                {selectedRecord.timeoutReason}
              </div>
            </Form.Item>
          )}
          <div style={styles.timeoutNote}>
            <p>
              Please select the actual time when the employee left the office.
            </p>
            <p style={styles.errorMessage}>
              <strong>Note:</strong> Timeout cannot be completed for the current
              date. Please wait until tomorrow to complete today's timeout.
            </p>
          </div>
        </Form>
      </Modal>

      <style>{`
        ::-webkit-scrollbar {
          display: none;
        }
        .ant-table {
          font-family: "Open Sans", sans-serif;
        }
        .ant-table-thead > tr > th {
          background-color: #351153 !important;
          color: white !important;
          font-family: "Montserrat", sans-serif !important;
          font-weight: bold !important;
          white-space: nowrap;
          text-align: center !important;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .ant-table-tbody > tr > td {
          text-align: center !important;
        }
        .ant-table-tbody > tr:hover > td {
          background-color: #f5f5f5 !important;
        }
        .ant-table-tbody > tr:nth-child(even) {
          background-color: #fafafa;
        }
        .ant-modal-content {
          border-radius: 12px;
        }
        .ant-input,
        .ant-picker {
          border-radius: 8px !important;
        }
        .ant-input:focus,
        .ant-picker-focused {
          border-color: #6a359c !important;
          box-shadow: 0 0 0 2px rgba(106, 53, 156, 0.2) !important;
        }
        .ant-btn-primary:hover {
          background-color: #6a359c !important;
          border-color: #6a359c !important;
          transform: scale(1.02);
          transition: all 0.2s ease-in-out;
        }
        .ant-tag-error {
          background-color: #f44336;
          color: white;
        }
        .ant-tag-warning {
          background-color: #ffc107;
          color: #212121;
        }
        .ant-table-cell {
          vertical-align: middle;
        }
        .ant-card-body {
          padding: 0 !important;
        }
        .ant-statistic-title {
          font-family: "Open Sans", sans-serif;
          font-size: 12px;
          color: #757575;
        }
        .ant-statistic-content {
          font-family: "Montserrat", sans-serif;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default MissedTimeoutPage;




