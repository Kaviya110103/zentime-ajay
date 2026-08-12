import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, resolveBackendAssetUrl } from "../config/api";
import { fetchBranchesFromLocationSet, uniqueBranchNames } from "../utils/branchSource";
import {
  FaUser,
  FaChevronDown,
  FaEye,
  FaEyeSlash,
  FaUserPlus,
} from "react-icons/fa";
import {
  AppBar,
  Toolbar,
  Typography,
} from "@mui/material";

export default function AddEmployee() {
  const EMPLOYEE_LIMIT_EXCEEDED_MESSAGE =
    "Employee limit exceeded. Kindly contact Super Admin.";
  const PROFILE_IMAGE_MAX_SIZE = 900;
  const PROFILE_IMAGE_QUALITY = 0.72;
  const navigate = useNavigate();
  const client = JSON.parse(localStorage.getItem("loggedInClient")); 
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const companyCode = String(client?.companyCode || "").trim().toLowerCase();
  const tenantOrigin = companyCode ? API_BASE_URL : "";
  const fallbackOrigin = API_BASE_URL;
  const API_BASE_PATH = "/api/employees";

  const buildApiUrl = (origin, path) => `${origin}${path}`;
  const isNetworkFailure = (error) =>
    error?.name === "TypeError" || error?.message?.includes("Failed to fetch");

  const fetchWithTenantFallback = async (path, options) => {
    const primaryUrl = buildApiUrl(tenantOrigin || fallbackOrigin, path);
    try {
      return await fetch(primaryUrl, options);
    } catch (error) {
      if (tenantOrigin && isNetworkFailure(error)) {
        return fetch(buildApiUrl(fallbackOrigin, path), options);
      }
      throw error;
    }
  };

  const normalizeAdditionalWorkingDays = (value) => {
    const dayTypeOrder = [
      "ODD_SATURDAY",
      "EVEN_SATURDAY",
      "ODD_SUNDAY",
      "EVEN_SUNDAY",
    ];
    const allowedDayTypes = new Set([
      "ODD_SATURDAY",
      "EVEN_SATURDAY",
      "ODD_SUNDAY",
      "EVEN_SUNDAY",
    ]);
    const uniqueDays = new Map();
    if (!Array.isArray(value)) return [];

    value.forEach((day) => {
      const normalizedDay = {
        dayType: String(day?.dayType || "").trim(),
        timeIn: String(day?.timeIn || "").trim(),
        timeOut: String(day?.timeOut || "").trim(),
      };
      if (allowedDayTypes.has(normalizedDay.dayType)) {
        uniqueDays.set(normalizedDay.dayType, normalizedDay);
      }
    });
    return dayTypeOrder
      .filter((dayType) => uniqueDays.has(dayType))
      .map((dayType) => uniqueDays.get(dayType));
  };

  const areAdditionalWorkingDaysEqual = (left, right) => {
    const normalizedLeft = normalizeAdditionalWorkingDays(left);
    const normalizedRight = normalizeAdditionalWorkingDays(right);
    if (normalizedLeft.length !== normalizedRight.length) return false;
    return normalizedLeft.every((day, index) => {
      const other = normalizedRight[index];
      return (
        day.dayType === other.dayType &&
        day.timeIn === other.timeIn &&
        day.timeOut === other.timeOut
      );
    });
  };

  const compressProfileImage = (file) =>
    new Promise((resolve, reject) => {
      if (!file?.type?.startsWith("image/")) {
        reject(new Error("Please choose a valid image file."));
        return;
      }

      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(
          1,
          PROFILE_IMAGE_MAX_SIZE / Math.max(image.width, image.height)
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to prepare image for upload."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Unable to compress image."));
              return;
            }
            const compressedName = `${file.name.replace(/\.[^.]+$/, "") || "profile"}.jpg`;
            resolve(new File([blob], compressedName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          PROFILE_IMAGE_QUALITY
        );
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to read selected image."));
      };

      image.src = objectUrl;
    });


  const initialEmployeeState = {
    firstName: "",
    lastName: "",
    mobile: "",
    gender: "",
    position: "",
    branch: "",
    username: "",
    password: "",
    dob: "",
    email: "",
    address: "",
    alternativeMobile: "",
    dateOfJoining: "",
    resetToken: "",
    salary: "",
    weekOff: "",
    leavePolicyType: "WEEKOFF",
    casualLeaveBalance: "",
    permissionAllowancePerMonth: "",
    shiftStartTime: "",
    shiftEndTime: "",
    additionalWorkingDays: [],
    employeeCode: "",
    clientId: client.id,
    companyCode: client.companyCode,
  };

  const [employee, setEmployee] = useState(initialEmployeeState);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [branchOptions, setBranchOptions] = useState([]);

  const formatPermissionAllowanceForInput = (value) => {
    if (value == null || value === "") return "";
    const count = Number.parseInt(value, 10);
    if (!Number.isFinite(count) || count < 0) return "";
    return `${count} ${count === 1 ? "hour" : "hours"}`;
  };

  const parsePermissionAllowanceToCount = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) {
      return { isValid: true, isEmpty: true, count: 0 };
    }

    if (/^\d+$/.test(raw)) {
      return { isValid: true, isEmpty: false, count: Number.parseInt(raw, 10) };
    }

    const normalized = raw.replace(/\s+/g, " ").trim();
    const durationMatch = normalized.match(
      /^(?:(\d+)\s*(?:h|hr|hrs|hour|hours))?(?:\s*(\d+)\s*(?:m|min|mins|minute|minutes))?$/
    );

    if (!durationMatch || (!durationMatch[1] && !durationMatch[2])) {
      return { isValid: false, isEmpty: false, count: 0 };
    }

    const hours = durationMatch[1] ? Number.parseInt(durationMatch[1], 10) : 0;
    const minutes = durationMatch[2] ? Number.parseInt(durationMatch[2], 10) : 0;
    const totalMinutes = hours * 60 + minutes;

    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
      return { isValid: false, isEmpty: false, count: 0 };
    }

    return {
      isValid: true,
      isEmpty: false,
      count: Math.ceil(totalMinutes / 60),
    };
  };

  const availableBranchOptions = useMemo(
    () => uniqueBranchNames([...(branchOptions || []), employee?.branch]),
    [branchOptions, employee?.branch]
  );

  useEffect(() => {
    let active = true;

    const fetchBranchOptions = async () => {
      if (!client?.id) {
        if (active) setBranchOptions([]);
        return;
      }
      try {
        const names = await fetchBranchesFromLocationSet(client.id);
        if (!active) return;
        setBranchOptions(names);
        setEmployee((prev) => {
          const current = String(prev?.branch || "").trim();
          if (current) return prev;
          return { ...prev, branch: names[0] || "" };
        });
      } catch (error) {
        console.error("Failed to fetch branches from Location Set:", error);
        if (active) setBranchOptions([]);
      }
    };

    fetchBranchOptions();

    return () => {
      active = false;
    };
  }, [client?.id]);

  useEffect(() => {
    if (!isEditMode) return;

    const fetchEmployeeForEdit = async () => {
      try {
        const response = await fetchWithTenantFallback(
          `${API_BASE_PATH}/${id}?clientId=${client?.id}`
        );
        if (!response.ok) {
          throw new Error(`Failed to load employee: ${response.status}`);
        }
        const data = await response.json();
        let additionalWorkingDays = normalizeAdditionalWorkingDays(
          data?.additionalWorkingDays
        );
        const additionalDaysResponse = await fetchWithTenantFallback(
          `${API_BASE_PATH}/${id}/additional-working-days?clientId=${client?.id}`
        );
        if (additionalDaysResponse.ok) {
          const additionalDaysData = await additionalDaysResponse.json();
          const dedicatedAdditionalWorkingDays =
            normalizeAdditionalWorkingDays(additionalDaysData);
          additionalWorkingDays = dedicatedAdditionalWorkingDays;
        }
        const inferredLeavePolicyType = (() => {
          if (data?.leavePolicyType) return data.leavePolicyType;
          const weekOffRaw = (data?.weekOff || "").toLowerCase();
          if (weekOffRaw.includes("sat") && weekOffRaw.includes("sun")) {
            return "WEEKEND_OFF";
          }
          return "WEEKOFF";
        })();
        setEmployee((prev) => ({
          ...prev,
          ...data,
          salary: data?.salary ?? "",
          leavePolicyType: inferredLeavePolicyType,
          casualLeaveBalance: data?.casualLeaveBalance ?? "",
          permissionAllowancePerMonth:
            data?.permissionAllowancePerMonth == null
              ? ""
              : formatPermissionAllowanceForInput(data.permissionAllowancePerMonth),
          additionalWorkingDays,
          password: "",
        }));
        setProfilePreview(resolveBackendAssetUrl(data?.profileImage) || "");
      } catch (error) {
        alert(`Error loading employee details: ${error.message}`);
        navigate(-1);
      }
    };

    fetchEmployeeForEdit();
  }, [API_BASE_PATH, client?.id, id, isEditMode, navigate, tenantOrigin]);

  const validateForm = () => {
    const newErrors = {};

    // Mobile number validation
    if (!/^\d{10}$/.test(employee.mobile)) {
      newErrors.mobile = "Please enter a valid 10-digit mobile number";
    }

    // Alternative mobile validation (if provided)
    if (
      employee.alternativeMobile &&
      !/^\d{10}$/.test(employee.alternativeMobile)
    ) {
      newErrors.alternativeMobile =
        "Please enter a valid 10-digit mobile number";
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (employee.dob) {
      const dobDate = new Date(employee.dob);
      if (dobDate >= today) {
        newErrors.dob = "Date of birth must be in the past";
      }
    }

    if (employee.dateOfJoining && employee.dob) {
      const joinDate = new Date(employee.dateOfJoining);
      const dobDate = new Date(employee.dob);
      if (joinDate < dobDate) {
        newErrors.dateOfJoining = "Joining date must be after date of birth";
      }
    }

    // Salary validation
    if (employee.salary && Number.parseFloat(employee.salary) <= 0) {
      newErrors.salary = "Salary must be a positive number";
    }
    const parsedPermissionAllowance = parsePermissionAllowanceToCount(
      employee.permissionAllowancePerMonth
    );
    if (!parsedPermissionAllowance.isValid) {
      newErrors.permissionAllowancePerMonth =
        "Use format like 1 hour 30 mins or 2 hours";
    } else if (
      !parsedPermissionAllowance.isEmpty &&
      parsedPermissionAllowance.count < 0
    ) {
      newErrors.permissionAllowancePerMonth =
        "Permission allowance per month cannot be negative";
    }

    if (!String(employee.branch || "").trim()) {
      newErrors.branch = "Please select a branch";
    }

    if ((employee.shiftStartTime && !employee.shiftEndTime) || (!employee.shiftStartTime && employee.shiftEndTime)) {
      newErrors.shift = "Both shift start and shift end time are required";
    }

    if (employee.shiftStartTime && employee.shiftEndTime && employee.shiftStartTime >= employee.shiftEndTime) {
      newErrors.shift = "Shift end time must be later than shift start time";
    }

    if (employee.leavePolicyType === "WEEKOFF") {
      if (!employee.weekOff || !employee.weekOff.trim()) {
        newErrors.weekOff = "Please select a week off day";
      }
    }

    if (employee.additionalWorkingDays && employee.additionalWorkingDays.length > 0) {
      for (const day of employee.additionalWorkingDays) {
        if (!day?.timeIn || !day?.timeOut) {
          newErrors.additionalWorkingDays = "Additional working days require time in and time out";
          break;
        }
        if (day.timeIn >= day.timeOut) {
          newErrors.additionalWorkingDays = "Additional working day time out must be later than time in";
          break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const ensureEmployeeLimitBeforeCreate = async () => {
    if (isEditMode || !client?.id) {
      return true;
    }

    try {
      const [clientRes, employeesRes] = await Promise.all([
        fetchWithTenantFallback(`/api/clients/${client.id}`),
        fetchWithTenantFallback(`${API_BASE_PATH}?clientId=${client.id}`),
      ]);

      if (!clientRes.ok || !employeesRes.ok) {
        return true;
      }

      const clientData = await clientRes.json();
      const employees = await employeesRes.json();
      const employeeLimit = Number.parseInt(
        clientData?.employeeCount ?? client?.employeeCount,
        10
      );
      const currentCount = Array.isArray(employees) ? employees.length : 0;

      if (
        Number.isFinite(employeeLimit) &&
        employeeLimit > 0 &&
        currentCount >= employeeLimit
      ) {
        alert(EMPLOYEE_LIMIT_EXCEEDED_MESSAGE);
        return false;
      }
    } catch (error) {
      console.error("Employee limit pre-check failed:", error);
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const canCreateEmployee = await ensureEmployeeLimitBeforeCreate();
    if (!canCreateEmployee) {
      return;
    }

    try {
      const parsedPermissionAllowance = parsePermissionAllowanceToCount(
        employee.permissionAllowancePerMonth
      );
      const additionalWorkingDaysPayload = normalizeAdditionalWorkingDays(
        employee.additionalWorkingDays
      );
      const payload = {
        ...employee,
        employeeCode: (employee.employeeCode || "").trim(),
        shiftStartTime: (employee.shiftStartTime || "").trim(),
        shiftEndTime: (employee.shiftEndTime || "").trim(),
        weekOff: (employee.weekOff || "").trim(),
        leavePolicyType: (employee.leavePolicyType || "WEEKOFF").trim(),
        casualLeaveBalance:
          employee.casualLeaveBalance === "" || employee.casualLeaveBalance == null
            ? 0
            : Number.parseInt(employee.casualLeaveBalance, 10) || 0,
        permissionAllowancePerMonth:
          parsedPermissionAllowance.isEmpty ? 0 : parsedPermissionAllowance.count || 0,
        salary: Number.parseFloat(employee.salary) || 0,
      };

      if (isEditMode) {
        // Keep additional working days updates in a dedicated request to avoid
        // accidental clears from partial profile payloads.
        delete payload.additionalWorkingDays;
        const trimmedPassword = (employee.password || "").trim();
        if (trimmedPassword) {
          payload.password = trimmedPassword;
        } else {
          // Keep existing password unchanged when field is left empty.
          delete payload.password;
        }
      } else {
        payload.additionalWorkingDays = additionalWorkingDaysPayload;
      }

      const response = await fetchWithTenantFallback(
        isEditMode
          ? `${API_BASE_PATH}/update/${id}?clientId=${client?.id}`
          : `${API_BASE_PATH}?clientId=${client?.id}`,
        {
          method: isEditMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const targetId = isEditMode ? id : data?.id;

        if (targetId) {
          const additionalDaysResponse = await fetchWithTenantFallback(
            `${API_BASE_PATH}/${targetId}/additional-working-days?clientId=${client?.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(additionalWorkingDaysPayload),
            }
          );

          if (!additionalDaysResponse.ok) {
            const additionalDaysError = await additionalDaysResponse.text();
            throw new Error(
              additionalDaysError?.trim() ||
                "Failed to save additional working days"
            );
          }

          const savedAdditionalDays = await additionalDaysResponse.json().catch(() => null);
          let syncedAdditionalDays = normalizeAdditionalWorkingDays(savedAdditionalDays);

          const verifyAdditionalDaysResponse = await fetchWithTenantFallback(
            `${API_BASE_PATH}/${targetId}/additional-working-days?clientId=${client?.id}`
          );
          if (verifyAdditionalDaysResponse.ok) {
            const verifyAdditionalDays = await verifyAdditionalDaysResponse
              .json()
              .catch(() => null);
            syncedAdditionalDays = normalizeAdditionalWorkingDays(verifyAdditionalDays);
          }

          if (!areAdditionalWorkingDaysEqual(syncedAdditionalDays, additionalWorkingDaysPayload)) {
            throw new Error("Additional working days did not update. Please try again.");
          }

          setEmployee((prev) => ({
            ...prev,
            additionalWorkingDays: syncedAdditionalDays,
          }));
        }

        if (profileFile) {
          if (!targetId) {
            alert("Profile image upload skipped (employee ID missing).");
          } else {
          const uploadFormData = new FormData();
          uploadFormData.append("file", profileFile);
          const uploadResponse = await fetchWithTenantFallback(
            `${API_BASE_PATH}/${targetId}/upload-image?clientId=${client?.id}`,
            {
              method: "PUT",
              body: uploadFormData,
            }
          );

          if (uploadResponse.ok) {
            const imageUrl = await uploadResponse.text();
            setEmployee((prev) => ({ ...prev, profileImage: imageUrl }));
            setProfilePreview(resolveBackendAssetUrl(imageUrl) || "");
          } else {
            const uploadError = await uploadResponse.text();
            alert(`Warning: Profile image upload failed: ${uploadError}`);
          }
          }
        }

        alert(
          isEditMode
            ? `Success: Employee ${data.firstName} updated!`
            : `Success: Employee ${data.firstName} added!`
        );
        handleCancel();
      } else {
        const rawError = await response.text();
        let error = (rawError || "").trim() || "Request failed";
        if (rawError) {
          try {
            const parsed = JSON.parse(rawError);
            if (parsed?.message && typeof parsed.message === "string") {
              error = parsed.message.trim();
            }
          } catch (_ignored) {
            // Use raw error text when payload is not JSON.
          }
        }
        if (!isEditMode && error === EMPLOYEE_LIMIT_EXCEEDED_MESSAGE) {
          alert(EMPLOYEE_LIMIT_EXCEEDED_MESSAGE);
          return;
        }
        alert(
          isEditMode
            ? error
            : `Failed to add employee: ${error}`
        );
      }
    } catch (error) {
      alert(`Error: ${error?.message || "Something went wrong. Check your network."}`);
      console.error("Submission error:", error);
    }
  };
  const handleChange = (key, value) => {
    // Special handling for mobile numbers to only allow digits
    if (key === "mobile" || key === "alternativeMobile") {
      if (value === "" || /^\d{0,10}$/.test(value)) {
        setEmployee((prev) => ({ ...prev, [key]: value }));
      }
    }
    // Special handling for salary to only allow positive numbers
    else if (key === "salary") {
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setEmployee((prev) => ({ ...prev, [key]: value }));
      }
    } else if (key === "casualLeaveBalance") {
      if (value === "" || /^\d{0,2}$/.test(value)) {
        setEmployee((prev) => ({ ...prev, [key]: value }));
      }
    } else if (key === "permissionAllowancePerMonth") {
      setEmployee((prev) => ({ ...prev, [key]: value }));
    } else {
      setEmployee((prev) => ({ ...prev, [key]: value }));
    }
  };

  const additionalDayOptions = [
    { key: "ODD_SATURDAY", label: "Odd Saturday" },
    { key: "EVEN_SATURDAY", label: "Even Saturday" },
    { key: "ODD_SUNDAY", label: "Odd Sunday" },
    { key: "EVEN_SUNDAY", label: "Even Sunday" },
  ];

  const getAdditionalDay = (dayType) =>
    employee.additionalWorkingDays?.find((day) => day.dayType === dayType);

  const toggleAdditionalDay = (dayType, checked) => {
    setEmployee((prev) => {
      const current = Array.isArray(prev.additionalWorkingDays)
        ? prev.additionalWorkingDays
        : [];
      if (checked) {
        if (current.some((day) => day.dayType === dayType)) {
          return prev;
        }
        return {
          ...prev,
          additionalWorkingDays: [
            ...current,
            { dayType, timeIn: "", timeOut: "" },
          ],
        };
      }
      return {
        ...prev,
        additionalWorkingDays: current.filter((day) => day.dayType !== dayType),
      };
    });
  };

  const updateAdditionalDayTime = (dayType, field, value) => {
    setEmployee((prev) => {
      const current = Array.isArray(prev.additionalWorkingDays)
        ? prev.additionalWorkingDays
        : [];
      return {
        ...prev,
        additionalWorkingDays: current.map((day) =>
          day.dayType === dayType ? { ...day, [field]: value } : day
        ),
      };
    });
  };

  const handleLeavePolicyChange = (value) => {
    setEmployee((prev) => ({
      ...prev,
      leavePolicyType: value,
      weekOff: value === "WEEKEND_OFF" ? "Saturday,Sunday" : prev.weekOff,
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleCancel = () => {
    setEmployee(initialEmployeeState);
    setErrors({});
    setShowPassword(false);
    setProfileFile(null);
    setProfilePreview("");
    // Navigate back to previous page
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/AdminDashboard"); // Fallback route if no history
    }
  };

  const handleProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProfileFile(null);
      setProfilePreview(resolveBackendAssetUrl(employee.profileImage) || "");
      return;
    }

    try {
      const compressedFile = await compressProfileImage(file);
      setProfileFile(compressedFile);
      const previewUrl = URL.createObjectURL(compressedFile);
      setProfilePreview(previewUrl);
    } catch (error) {
      alert(error?.message || "Unable to prepare selected image.");
      setProfileFile(null);
      setProfilePreview(resolveBackendAssetUrl(employee.profileImage) || "");
      e.target.value = "";
    }
  };

  return (
    <div style={styles.container}>
      <AppBar
        position="static"
        elevation={0}
        sx={{ 
          backgroundColor: "#351153",
          background: "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
          borderBottom: "3px solid #FFD700"
        }}
      >
        <Toolbar>
          <div style={styles.headerLeft}>
            <div style={styles.headerIcon}>
              <FaUserPlus size={24} color="#FFFFFF" />
            </div>
            <Typography
              variant="h6"
              component="div"
              sx={{ 
                flexGrow: 1, 
                color: "white",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "1.5rem",
                textShadow: "1px 1px 2px rgba(0,0,0,0.3)"
              }}
            >
              {isEditMode ? "Edit Employee" : "New Employee Registration"}
            </Typography>
          </div>
        </Toolbar>
      </AppBar>

      <div style={styles.contentContainer}>
        <div style={styles.formWrapper}>
          {/* Profile Header with Enhanced Design */}
          <div style={styles.profileHeader}>
            <div style={styles.profileCard}>
              <div style={styles.profileIconContainer}>
                <div style={styles.profileIconWrapper}>
                  {profilePreview ? (
                    <img
                      src={profilePreview}
                      alt="Profile"
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "16px" }}
                    />
                  ) : (
                    <FaUser size={48} color="#351153" />
                  )}
                </div>
              </div>
              <div style={styles.profileText}>
                <h1 style={styles.editProfileTitle}>{isEditMode ? "Edit Employee" : "Add New Employee"}</h1>
                <div style={styles.companyBadge}>
                  <span style={styles.companyName}>{client.companyName}</span>
                  <span style={styles.companyCode}>{client.companyCode}</span>
                </div>
                <div style={styles.profileUploadRow}>
                  <label style={styles.uploadLabel} htmlFor="profileImage">
                    Upload Profile Photo
                  </label>
                  <input
                    id="profileImage"
                    type="file"
                    accept="image/*"
                    onChange={handleProfileFileChange}
                    style={styles.uploadInput}
                  />
                  {profileFile && (
                    <span style={styles.uploadHint}>{profileFile.name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form with Enhanced Design */}
          <form style={styles.formContainer} onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              {/* Personal Information Section */}
              <div style={styles.formSection}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>👤</div>
                  <h3 style={styles.sectionTitle}>Personal Information</h3>
                </div>
                <div style={styles.sectionGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="firstName">
                      First Name <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="firstName"
                        style={styles.input}
                        placeholder="Enter first name"
                        value={employee.firstName}
                        onChange={(e) => handleChange("firstName", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="lastName">
                      Last Name <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="lastName"
                        style={styles.input}
                        placeholder="Enter last name"
                        value={employee.lastName}
                        onChange={(e) => handleChange("lastName", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="gender">Gender</label>
                    <div style={styles.pickerContainer}>
                      <select
                        id="gender"
                        value={employee.gender}
                        style={styles.picker}
                        onChange={(e) => handleChange("gender", e.target.value)}
                        required
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <FaChevronDown
                        size={14}
                        color="#351153"
                        style={styles.pickerIcon}
                      />
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="dob">
                      Date of Birth <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="dob"
                        style={styles.input}
                        type="date"
                        value={employee.dob}
                        onChange={(e) => handleChange("dob", e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        required
                      />
                    </div>
                    {errors.dob && (
                      <span style={styles.errorText}>{errors.dob}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div style={styles.formSection}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>📞</div>
                  <h3 style={styles.sectionTitle}>Contact Information</h3>
                </div>
                <div style={styles.sectionGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="mobile">
                      Mobile Number <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="mobile"
                        style={styles.input}
                        placeholder="Enter mobile number"
                        type="tel"
                        value={employee.mobile}
                        onChange={(e) => handleChange("mobile", e.target.value)}
                        maxLength="10"
                        pattern="\d{10}"
                        required
                      />
                    </div>
                    {errors.mobile && (
                      <span style={styles.errorText}>{errors.mobile}</span>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="alternativeMobile">Alternative Number</label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="alternativeMobile"
                        style={styles.input}
                        placeholder="Enter alternative number"
                        type="tel"
                        value={employee.alternativeMobile}
                        onChange={(e) =>
                          handleChange("alternativeMobile", e.target.value)
                        }
                        maxLength="10"
                        pattern="\d{10}"
                      />
                    </div>
                    {errors.alternativeMobile && (
                      <span style={styles.errorText}>
                        {errors.alternativeMobile}
                      </span>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="email">
                      Email <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="email"
                        style={styles.input}
                        placeholder="Enter email address"
                        type="email"
                        value={employee.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        required
                      />
                    </div>
                    {errors.email && (
                      <span style={styles.errorText}>{errors.email}</span>
                    )}
                  </div>
                  <div style={styles.inputGroupFull}>
                    <label style={styles.label} htmlFor="address">
                      Address <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <textarea
                        id="address"
                        style={styles.largeInput}
                        placeholder="Enter full address"
                        rows={3}
                        value={employee.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment Information Section */}
              <div style={styles.formSection}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>💼</div>
                  <h3 style={styles.sectionTitle}>Employment Information</h3>
                </div>
                <div style={styles.sectionGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="position">
                      Position <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="position"
                        style={styles.input}
                        placeholder="Enter position"
                        value={employee.position}
                        onChange={(e) => handleChange("position", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="branch">
                      Branch <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.pickerContainer}>
                      <select
                        id="branch"
                        value={employee.branch}
                        style={styles.picker}
                        onChange={(e) => handleChange("branch", e.target.value)}
                        disabled={availableBranchOptions.length === 0}
                        required
                      >
                        {availableBranchOptions.length === 0 ? (
                          <option value="">
                            No branches found. Add branches in Location Set.
                          </option>
                        ) : (
                          availableBranchOptions.map((branchName) => (
                            <option key={branchName} value={branchName}>
                              {branchName}
                            </option>
                          ))
                        )}
                      </select>
                      <FaChevronDown
                        size={14}
                        color="#351153"
                        style={styles.pickerIcon}
                      />
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="dateOfJoining">
                      Date of Joining <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="dateOfJoining"
                        style={styles.input}
                        type="date"
                        value={employee.dateOfJoining}
                        onChange={(e) =>
                          handleChange("dateOfJoining", e.target.value)
                        }
                        min={employee.dob || undefined}
                        required
                      />
                    </div>
                    {errors.dateOfJoining && (
                      <span style={styles.errorText}>{errors.dateOfJoining}</span>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="salary">
                      Salary <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <div style={styles.currencyWrapper}>
                        <span style={styles.currencySymbol}>₹</span>
                        <input
                          id="salary"
                          style={{...styles.input, paddingLeft: '32px'}}
                          placeholder="0.00"
                          type="number"
                          value={employee.salary}
                          onChange={(e) => handleChange("salary", e.target.value)}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>
                    {errors.salary && (
                      <span style={styles.errorText}>{errors.salary}</span>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Leave Policy</label>
                    <div style={styles.radioGroup}>
                      <label style={styles.radioOption}>
                        <input
                          type="radio"
                          name="leavePolicyType"
                          value="WEEKOFF"
                          checked={employee.leavePolicyType === "WEEKOFF"}
                          onChange={(e) => handleLeavePolicyChange(e.target.value)}
                        />
                        Week Off (Select Day)
                      </label>
                      <label style={styles.radioOption}>
                        <input
                          type="radio"
                          name="leavePolicyType"
                          value="WEEKEND_OFF"
                          checked={employee.leavePolicyType === "WEEKEND_OFF"}
                          onChange={(e) => handleLeavePolicyChange(e.target.value)}
                        />
                        Saturday + Sunday Off
                      </label>
                    </div>
                  </div>
                  {employee.leavePolicyType === "WEEKOFF" && (
                    <div style={styles.inputGroup}>
                      <label style={styles.label} htmlFor="weekOff">
                        Week Off Day <span style={styles.required}>*</span>
                      </label>
                      <div style={styles.pickerContainer}>
                        <select
                          id="weekOff"
                          value={employee.weekOff}
                          style={styles.picker}
                          onChange={(e) => handleChange("weekOff", e.target.value)}
                          required
                        >
                          <option value="">Select Day</option>
                          <option value="Monday">Monday</option>
                          <option value="Tuesday">Tuesday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Thursday">Thursday</option>
                          <option value="Friday">Friday</option>
                          <option value="Saturday">Saturday</option>
                          <option value="Sunday">Sunday</option>
                        </select>
                        <FaChevronDown
                          size={14}
                          color="#351153"
                          style={styles.pickerIcon}
                        />
                      </div>
                      {errors.weekOff && (
                        <span style={styles.errorText}>{errors.weekOff}</span>
                      )}
                    </div>
                  )}
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="casualLeaveBalance">
                      Casual Leave Balance
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="casualLeaveBalance"
                        style={styles.input}
                        type="number"
                        min="0"
                        max="30"
                        placeholder="e.g., 2"
                        value={employee.casualLeaveBalance ?? ""}
                        onChange={(e) => handleChange("casualLeaveBalance", e.target.value)}
                      />
                    </div>
                    {errors.branch && (
                      <span style={styles.errorText}>{errors.branch}</span>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="permissionAllowancePerMonth">
                      Permission Allowance / Month
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="permissionAllowancePerMonth"
                        style={styles.input}
                        type="text"
                        placeholder="e.g., 1 hour 30 mins or 2 hours"
                        value={employee.permissionAllowancePerMonth ?? ""}
                        onChange={(e) =>
                          handleChange("permissionAllowancePerMonth", e.target.value)
                        }
                      />
                    </div>
                    <span style={styles.helperText}>
                      Example: 1 hour 30 mins or 2 hours
                    </span>
                    {errors.permissionAllowancePerMonth && (
                      <span style={styles.errorText}>
                        {errors.permissionAllowancePerMonth}
                      </span>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="shiftStartTime">Shift Start Time</label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="shiftStartTime"
                        style={styles.input}
                        type="time"
                        value={employee.shiftStartTime || ""}
                        onChange={(e) => handleChange("shiftStartTime", e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="shiftEndTime">Shift End Time</label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="shiftEndTime"
                        style={styles.input}
                        type="time"
                        value={employee.shiftEndTime || ""}
                        onChange={(e) => handleChange("shiftEndTime", e.target.value)}
                      />
                    </div>
                  </div>
                  {errors.shift && (
                    <div style={styles.inputGroupFull}>
                      <span style={styles.errorText}>{errors.shift}</span>
                    </div>
                  )}
                  <div style={styles.inputGroupFull}>
                    <label style={styles.label}>Additional Working Days (Optional)</label>
                    <div style={styles.checkboxGrid}>
                      {additionalDayOptions.map((option) => {
                        const selected = Boolean(getAdditionalDay(option.key));
                        return (
                          <label key={option.key} style={styles.checkboxOption}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => toggleAdditionalDay(option.key, e.target.checked)}
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                    {employee.additionalWorkingDays?.length > 0 && (
                      <div style={styles.additionalTimeGrid}>
                        {normalizeAdditionalWorkingDays(employee.additionalWorkingDays).map((day) => (
                          <div key={day.dayType} style={styles.additionalDayRow}>
                            <div style={styles.additionalDayLabel}>
                              {additionalDayOptions.find((opt) => opt.key === day.dayType)?.label ||
                                day.dayType}
                            </div>
                            <input
                              type="time"
                              style={styles.additionalTimeInput}
                              value={day.timeIn || ""}
                              onChange={(e) =>
                                updateAdditionalDayTime(day.dayType, "timeIn", e.target.value)
                              }
                            />
                            <input
                              type="time"
                              style={styles.additionalTimeInput}
                              value={day.timeOut || ""}
                              onChange={(e) =>
                                updateAdditionalDayTime(day.dayType, "timeOut", e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {errors.additionalWorkingDays && (
                      <span style={styles.errorText}>{errors.additionalWorkingDays}</span>
                    )}
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="employeeCode">Employee Code</label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="employeeCode"
                        style={styles.input}
                        placeholder={`Auto if empty (${client.companyCode}.EMP<ID>)`}
                        value={employee.employeeCode || ""}
                        onChange={(e) => handleChange("employeeCode", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Login Credentials Section */}
              <div style={styles.formSection}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🔐</div>
                  <h3 style={styles.sectionTitle}>Login Credentials</h3>
                </div>
                <div style={styles.sectionGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="username">
                      User Name <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="username"
                        style={styles.input}
                        placeholder="Enter username"
                        value={employee.username}
                        onChange={(e) => handleChange("username", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="password">
                      Password <span style={styles.required}>*</span>
                    </label>
                    <div style={styles.passwordWrapper}>
                      <input
                        id="password"
                        style={styles.input}
                        placeholder="Enter password"
                        type={showPassword ? "text" : "password"}
                        value={employee.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        required={!isEditMode}
                      />
                      <button
                        type="button"
                        style={styles.eyeButton}
                        onClick={togglePasswordVisibility}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label} htmlFor="companyCode">Company Code</label>
                    <div style={styles.inputWrapper}>
                      <input
                        id="companyCode"
                        style={{...styles.input, backgroundColor: '#f8f9fa'}}
                        placeholder="Company code"
                        value={client.companyCode}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={styles.buttonContainer}>
              <button
                style={styles.cancelButton}
                aria-label="Cancel"
                type="button"
                onClick={handleCancel}
              >
                <span style={styles.cancelButtonText}>Cancel</span>
              </button>
              <button style={styles.saveButton} aria-label="Save" type="submit">
                <FaUserPlus style={styles.saveIcon} />
                <span style={styles.saveButtonText}>{isEditMode ? "Update Employee" : "Create Employee"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    backgroundColor: "#F8F9FA",
    fontFamily: "'Inter', sans-serif",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    width: "100%",
  },
  headerIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    backgroundColor: "rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(10px)",
  },
  contentContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    width: "100%",
    minHeight: "calc(100vh - 80px)",
    padding: "32px 24px",
    overflowY: "auto",
  },
  formWrapper: {
    width: "100%",
    maxWidth: "1000px",
    background: "#FFFFFF",
    borderRadius: "20px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
    padding: "40px",
    transition: "all 0.3s ease",
    border: "1px solid rgba(255,255,255,0.2)",
    backdropFilter: "blur(10px)",
  },
  profileHeader: {
    marginBottom: "40px",
  },
  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    padding: "24px",
    background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    borderRadius: "16px",
    border: "2px dashed #dee2e6",
  },
  profileIconContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  profileIconWrapper: {
    width: "100px",
    height: "100px",
    borderRadius: "20px",
    backgroundColor: "#FFFFFF",
    border: "3px solid #351153",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 20px rgba(53, 17, 83, 0.3)",
    transition: "all 0.3s ease",
  },
  profileText: {
    flex: 1,
  },
  profileUploadRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "12px",
    flexWrap: "wrap",
  },
  uploadLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#351153",
  },
  uploadInput: {
    fontSize: "13px",
  },
  uploadHint: {
    fontSize: "12px",
    color: "#6c757d",
  },
  editProfileTitle: {
    fontWeight: 700,
    fontSize: "28px",
    color: "#351153",
    fontFamily: "'Montserrat', sans-serif",
    margin: "0 0 8px 0",
    background: "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  companyBadge: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  companyName: {
    backgroundColor: "#351153",
    color: "white",
    padding: "6px 16px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: "'Montserrat', sans-serif",
  },
  companyCode: {
    backgroundColor: "#FFD700",
    color: "#351153",
    padding: "6px 16px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 700,
    fontFamily: "'Montserrat', sans-serif",
  },
  formContainer: {
    width: "100%",
  },
  formGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
  },
  formSection: {
    background: "#FFFFFF",
    borderRadius: "16px",
    padding: "0",
    border: "1px solid #f1f3f4",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    overflow: "hidden",
    transition: "all 0.3s ease",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 24px",
    background: "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
    borderBottom: "2px solid #FFD700",
  },
  sectionIcon: {
    fontSize: "20px",
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    backgroundColor: "rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(10px)",
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "18px",
    color: "#FFFFFF",
    fontFamily: "'Montserrat', sans-serif",
    margin: 0,
    textShadow: "1px 1px 2px rgba(0,0,0,0.2)",
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    padding: "24px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  inputGroupFull: {
    gridColumn: "1 / span 2",
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontWeight: 600,
    fontSize: "14px",
    color: "#351153",
    marginBottom: "8px",
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  required: {
    color: "#e74c3c",
    fontSize: "16px",
  },
  inputWrapper: {
    position: "relative",
    width: "100%",
  },
  input: {
    border: "2px solid #e9ecef",
    borderRadius: "12px",
    padding: "14px 16px",
    fontSize: "14px",
    color: "#2d3748",
    backgroundColor: "#FFFFFF",
    height: "52px",
    fontFamily: "'Inter', sans-serif",
    width: "100%",
    boxSizing: "border-box",
    transition: "all 0.3s ease",
    outline: "none",
    ":focus": {
      borderColor: "#351153",
      boxShadow: "0 0 0 3px rgba(53, 17, 83, 0.1)",
      transform: "translateY(-2px)",
    },
  },
  largeInput: {
    border: "2px solid #e9ecef",
    borderRadius: "12px",
    padding: "14px 16px",
    fontSize: "14px",
    color: "#2d3748",
    backgroundColor: "#FFFFFF",
    height: "100px",
    resize: "vertical",
    fontFamily: "'Inter', sans-serif",
    width: "100%",
    boxSizing: "border-box",
    transition: "all 0.3s ease",
    outline: "none",
    ":focus": {
      borderColor: "#351153",
      boxShadow: "0 0 0 3px rgba(53, 17, 83, 0.1)",
      transform: "translateY(-2px)",
    },
  },
  pickerContainer: {
    border: "2px solid #e9ecef",
    borderRadius: "12px",
    backgroundColor: "#FFFFFF",
    height: "52px",
    display: "flex",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    transition: "all 0.3s ease",
    ":focusWithin": {
      borderColor: "#351153",
      boxShadow: "0 0 0 3px rgba(53, 17, 83, 0.1)",
      transform: "translateY(-2px)",
    },
  },
  picker: {
    width: "100%",
    height: "100%",
    color: "#2d3748",
    padding: "0 42px 0 16px",
    border: "none",
    appearance: "none",
    background: "transparent",
    outline: "none",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    fontSize: "14px",
    fontWeight: 500,
  },
  pickerIcon: {
    position: "absolute",
    right: "16px",
    pointerEvents: "none",
  },
  radioGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px 0",
  },
  radioOption: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#2d3748",
    fontWeight: 500,
  },
  checkboxGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    padding: "10px 0",
  },
  checkboxOption: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#2d3748",
    fontWeight: 500,
  },
  additionalTimeGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #e9ecef",
    backgroundColor: "#f8f9fa",
  },
  additionalDayRow: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) minmax(120px, 180px) minmax(120px, 180px)",
    gap: "12px",
    alignItems: "center",
  },
  additionalDayLabel: {
    fontWeight: 600,
    color: "#351153",
    fontSize: "14px",
  },
  additionalTimeInput: {
    border: "2px solid #e9ecef",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#2d3748",
    backgroundColor: "#FFFFFF",
    height: "44px",
    fontFamily: "'Inter', sans-serif",
    outline: "none",
  },
  passwordWrapper: {
    position: "relative",
    width: "100%",
  },
  currencyWrapper: {
    position: "relative",
    width: "100%",
  },
  currencySymbol: {
    position: "absolute",
    left: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#351153",
    fontWeight: 600,
    fontSize: "16px",
    zIndex: 1,
  },
  eyeButton: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#351153",
    padding: "8px",
    borderRadius: "6px",
    transition: "all 0.3s ease",
    ":hover": {
      backgroundColor: "#f8f9fa",
      transform: "translateY(-50%) scale(1.1)",
    },
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "16px",
    marginTop: "40px",
    paddingTop: "24px",
    borderTop: "2px solid #f1f3f4",
  },
  cancelButton: {
    minWidth: "140px",
    borderRadius: "12px",
    padding: "16px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #351153",
    cursor: "pointer",
    backgroundColor: "transparent",
    transition: "all 0.3s ease",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    ":hover": {
      backgroundColor: "#351153",
      transform: "translateY(-2px)",
      boxShadow: "0 4px 12px rgba(53, 17, 83, 0.2)",
    },
  },
  saveButton: {
    minWidth: "200px",
    borderRadius: "12px",
    padding: "16px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#351153",
    background: "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
    transition: "all 0.3s ease",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    gap: "8px",
    boxShadow: "0 4px 15px rgba(53, 17, 83, 0.3)",
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 6px 20px rgba(53, 17, 83, 0.4)",
      background: "linear-gradient(135deg, #5a2d8a 0%, #351153 100%)",
    },
  },
  cancelButtonText: {
    color: "#351153",
    fontWeight: 600,
    fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    transition: "color 0.3s ease",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
  },
  saveIcon: {
    fontSize: "16px",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: "12px",
    marginTop: "6px",
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
  },
  helperText: {
    color: "#6c757d",
    fontSize: "12px",
    marginTop: "6px",
    fontFamily: "'Inter', sans-serif",
  },
};

// Add hover effects using inline styles approach
Object.assign(styles.profileIconWrapper, {
  ':hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 12px 30px rgba(53, 17, 83, 0.4)',
    backgroundColor: '#f8f9fa',
  },
});

Object.assign(styles.cancelButton, {
  ':hover .cancelButtonText': {
    color: '#FFFFFF',
  },
});

Object.assign(styles.formSection, {
  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
  },
});















