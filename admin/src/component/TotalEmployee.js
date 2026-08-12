import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaUser,
  FaUserAlt,
  FaPhone,
  FaEnvelope,
  FaHome,
  FaBriefcase,
  FaBuilding,
  FaMoneyBillAlt,
  FaCalendarAlt,
  FaInfoCircle,
  FaIdBadge,
  FaVenusMars,
  FaMobile,
  FaMobileAlt,
  FaUserCircle,
  FaFilter,
  FaTrash, // Added delete icon
  FaEdit, // Optional: for future edit feature
} from "react-icons/fa";
import {
  MdFace,
  MdFace3,
  MdEngineering,
  MdWeekend,
  MdPersonPin,
} from "react-icons/md";
import styled, { keyframes, css } from "styled-components";
import { API_BASE_URL, resolveBackendAssetUrl } from "../config/api";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";

// Color system
const colors = {
  primary: "#351153",
  primaryLight: "#4A1D6D",
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FFC107",
  info: "#2196F3",
  background: "#F5F5F5",
  card: "#FFFFFF",
  textPrimary: "#212121",
  textSecondary: "#757575",
  hoverLight: "#F5F5F5",
  hoverDark: "#4A1D6D",
  divider: "#E0E0E0",
};

// Animation
const pulse = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

// Breakpoints
const breakpoints = {
  mobile: "576px",
  tablet: "768px",
  laptop: "992px",
  desktop: "1200px",
};

// Media query helpers
const mobile = (styles) => css`
  @media (max-width: ${breakpoints.mobile}) {
    ${styles}
  }
`;

const tablet = (styles) => css`
  @media (min-width: ${breakpoints.mobile}) and (max-width: ${breakpoints.tablet}) {
    ${styles}
  }
`;

const laptop = (styles) => css`
  @media (min-width: ${breakpoints.tablet}) and (max-width: ${breakpoints.laptop}) {
    ${styles}
  }
`;

const desktop = (styles) => css`
  @media (min-width: ${breakpoints.laptop}) {
    ${styles}
  }
`;

// Styled components
const Container = styled.div`
  padding: 20px;
  background-color: ${colors.background};
  font-family: "Open Sans", sans-serif;
  min-height: 100vh;

  ${laptop(css`
    padding: 16px;
  `)}

  ${tablet(css`
    padding: 14px;
  `)}

  ${mobile(css`
    padding: 12px;
  `)}
`;

const HeaderRow = styled.div`
  display: flex;
  flex-direction: row;
  padding: 7px 5px;
  background: linear-gradient(
    135deg,
    ${colors.primary} 0%,
    ${colors.primaryLight} 100%
  );
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  margin-bottom: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 2;
  height: 50px;

  ${tablet(css`
    padding: 12px 8px;
    height: 45px;
  `)}

  ${mobile(css`
    display: none;
  `)}
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  padding: 14px 10px;
  background-color: ${(props) =>
    props.$isEven ? colors.background : colors.card};
  border-bottom: 1px solid ${colors.divider};
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${colors.hoverLight};
    transform: scale(1.002);
  }

  ${laptop(css`
    padding: 12px 8px;
  `)}

  ${tablet(css`
    padding: 10px 6px;
  `)}

  ${mobile(css`
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
    gap: 8px;
    border-radius: 8px;
    margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    background-color: ${colors.card};
  `)}
`;

const HeaderText = styled.div`
  font-weight: 600;
  color: white;
  padding: 15px;
  text-align: center;
  font-size: 14px;
  font-family: "Montserrat", sans-serif;

  ${laptop(css`
    font-size: 13px;
  `)}

  ${tablet(css`
    font-size: 12px;
  `)}
`;

const CellText = styled.div`
  text-align: center;
  color: ${colors.textPrimary};
  font-size: 14px;

  ${laptop(css`
    font-size: 13px;
  `)}

  ${tablet(css`
    font-size: 12px;
  `)}

  ${mobile(css`
    text-align: left;
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  `)}
`;

const MobileLabel = styled.span`
  font-weight: 600;
  color: ${colors.textSecondary};
  margin-right: 8px;
  display: none;

  ${mobile(css`
    display: inline;
  `)}
`;

const ProfileContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 4px 0;
  gap: 12px;
  width: 100%;

  ${mobile(css`
    margin-bottom: 8px;
    border-bottom: 1px solid ${colors.divider};
    padding-bottom: 12px;
  `)}
`;

const ProfileImage = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 21px;
  background-color: ${colors.primary}20;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  overflow: hidden;

  ${laptop(css`
    width: 40px;
    height: 40px;
  `)}

  ${mobile(css`
    width: 48px;
    height: 48px;
    border-radius: 24px;
  `)}
`;

const ProfileName = styled.div`
  font-size: 15px;
  color: ${colors.textPrimary};
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  font-family: "Montserrat", sans-serif;

  ${laptop(css`
    font-size: 14px;
    max-width: 160px;
  `)}

  ${tablet(css`
    max-width: 140px;
  `)}

  ${mobile(css`
    max-width: 100%;
    font-size: 16px;
    font-weight: 600;
  `)}
`;

const BackButton = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 20px;
  cursor: pointer;
  background-color: ${colors.card};
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  width: fit-content;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${colors.hoverLight};
    transform: scale(1.02);
  }

  ${laptop(css`
    padding: 10px 14px;
    margin-bottom: 18px;
  `)}

  ${tablet(css`
    padding: 8px 12px;
    margin-bottom: 16px;
  `)}

  ${mobile(css`
    padding: 8px 12px;
    margin-bottom: 12px;
  `)}
`;

const BackIcon = styled(FaArrowLeft)`
  color: ${colors.primary};
  font-size: 18px;

  ${mobile(css`
    font-size: 16px;
  `)}
`;

const BackButtonText = styled.span`
  color: ${colors.primary};
  margin-left: 8px;
  font-size: 16px;
  font-weight: 500;
  font-family: "Montserrat", sans-serif;

  ${laptop(css`
    font-size: 15px;
  `)}

  ${mobile(css`
    font-size: 14px;
  `)}
`;

const Header = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 24px;
  background-color: ${colors.card};
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid ${colors.divider};

  ${laptop(css`
    padding: 20px;
    margin-bottom: 20px;
  `)}

  ${tablet(css`
    padding: 18px;
    margin-bottom: 18px;
  `)}

  ${mobile(css`
    flex-direction: column;
    text-align: center;
    padding: 16px;
    gap: 12px;
  `)}
`;

const AvatarContainer = styled.div`
  background-color: ${colors.primary}20;
  width: 100px;
  height: 100px;
  border-radius: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 24px;
  flex-shrink: 0;
  overflow: hidden;

  ${laptop(css`
    width: 90px;
    height: 90px;
    margin-right: 20px;
  `)}

  ${tablet(css`
    width: 80px;
    height: 80px;
    margin-right: 18px;
  `)}

  ${mobile(css`
    margin-right: 0;
    width: 100px;
    height: 100px;
  `)}
`;

const Section = styled.div`
  background-color: ${colors.card};
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid ${colors.divider};
  width: 100%;
  flex: 1;

  ${laptop(css`
    padding: 18px;
  `)}

  ${tablet(css`
    padding: 16px;
  `)}

  ${mobile(css`
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 16px;
  `)}
`;

const SectionHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid ${colors.divider};

  ${mobile(css`
    margin-bottom: 16px;
    padding-bottom: 12px;
  `)}
`;

const SectionIcon = styled.div`
  color: ${colors.primary};
  font-size: 20px;

  ${laptop(css`
    font-size: 18px;
  `)}

  ${mobile(css`
    font-size: 16px;
  `)}
`;

const SectionTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: ${colors.primary};
  margin-left: 12px;
  font-family: "Montserrat", sans-serif;

  ${laptop(css`
    font-size: 17px;
    margin-left: 10px;
  `)}

  ${mobile(css`
    font-size: 16px;
    margin-left: 8px;
  `)}
`;

const IconContainer = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: ${colors.primary}20;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 16px;
  color: ${colors.primary};
  flex-shrink: 0;

  ${laptop(css`
    width: 36px;
    height: 36px;
    margin-right: 14px;
  `)}

  ${tablet(css`
    width: 32px;
    height: 32px;
    margin-right: 12px;
  `)}

  ${mobile(css`
    width: 32px;
    height: 32px;
    margin-right: 10px;
  `)}
`;

const Label = styled.div`
  font-weight: 600;
  font-size: 15px;
  width: 160px;
  color: ${colors.textSecondary};
  flex-shrink: 0;
  font-family: "Montserrat", sans-serif;

  ${laptop(css`
    font-size: 14px;
    width: 150px;
  `)}

  ${tablet(css`
    width: 140px;
  `)}

  ${mobile(css`
    width: 50%;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  `)}
`;

const Value = styled.div`
  font-size: 15px;
  color: ${colors.textPrimary};
  flex: 1;
  padding: 10px;
  background-color: ${colors.card};
  border-radius: 8px;
  border: 1px solid ${colors.divider};
  word-break: break-word;

  ${laptop(css`
    font-size: 14px;
    padding: 8px;
  `)}

  ${tablet(css`
    font-size: 13px;
    padding: 6px;
  `)}

  ${mobile(css`
    width: 100%;
    padding: 6px 0;
    font-size: 13px;
    background-color: transparent;
    border: none;
    margin-left: 42px;
  `)}
`;

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  max-height: 50vh;
  border-radius: 0 0 8px 8px;
  border: 1px solid ${colors.divider};
  border-top: none;
  background-color: ${colors.card};
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  ${mobile(css`
    border: none;
    background-color: transparent;
    overflow-y: visible;
    max-height: none;
  `)}
`;

const TableContainer = styled.div`
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;

  ${laptop(css`
    max-height: calc(100vh - 180px);
  `)}

  ${tablet(css`
    max-height: calc(100vh - 160px);
  `)}

  ${mobile(css`
    max-height: none;
    box-shadow: none;
  `)}
`;

const TwoColumnContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  width: 100%;

  ${laptop(css`
    gap: 20px;
  `)}

  ${tablet(css`
    gap: 16px;
  `)}

  ${mobile(css`
    flex-direction: column;
    gap: 16px;
  `)}
`;

const DetailColumn = styled.div`
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  ${mobile(css`
    width: 100%;
  `)}
`;

const DetailRowTable = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12px 0;
  width: 100%;

  ${mobile(css`
    flex-direction: row;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 0;
  `)}
`;

const FilterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

  ${laptop(css`
    margin-bottom: 18px;
    gap: 10px;
  `)}

  ${tablet(css`
    margin-bottom: 16px;
    gap: 8px;
  `)}

  ${mobile(css`
    width: 100%;
    margin-bottom: 12px;
  `)}
`;

const FilterSelect = styled.select`
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid ${colors.divider};
  background-color: ${colors.card};
  font-size: 15px;
  color: ${colors.textPrimary};
  cursor: pointer;
  min-width: 220px;
  font-family: "Open Sans", sans-serif;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${colors.primaryLight};
    box-shadow: 0 0 0 2px ${colors.primaryLight}20;
  }

  ${laptop(css`
    padding: 8px 12px;
    font-size: 14px;
    min-width: 200px;
  `)}

  ${tablet(css`
    min-width: 180px;
  `)}

  ${mobile(css`
    flex-grow: 1;
    min-width: auto;
    font-size: 13px;
  `)}
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 8px;
  color: ${colors.textPrimary};
  font-family: "Montserrat", sans-serif;

  ${laptop(css`
    font-size: 22px;
  `)}

  ${tablet(css`
    font-size: 20px;
  `)}

  ${mobile(css`
    font-size: 20px;
  `)}
`;

const Subtitle = styled.div`
  font-size: 16px;
  color: ${colors.textSecondary};
  margin-bottom: 8px;
  font-weight: 500;
  font-family: "Montserrat", sans-serif;

  ${laptop(css`
    font-size: 15px;
  `)}

  ${mobile(css`
    font-size: 14px;
  `)}
`;

const Company = styled.div`
  font-size: 14px;
  color: ${colors.textSecondary};
  font-style: italic;

  ${laptop(css`
    font-size: 13px;
  `)}

  ${mobile(css`
    font-size: 12px;
  `)}
`;

const LoaderContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: ${colors.background};
`;

const Loader = styled.div`
  color: ${colors.primary};
  font-size: 20px;
  animation: ${pulse} 1.5s infinite;

  ${mobile(css`
    font-size: 18px;
  `)}
`;

const ErrorContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: ${colors.background};
  flex-direction: column;
  padding: 24px;
  text-align: center;

  ${mobile(css`
    padding: 20px;
  `)}
`;

const ErrorText = styled.div`
  color: ${colors.error};
  font-size: 18px;
  margin-bottom: 24px;

  ${laptop(css`
    font-size: 16px;
    margin-bottom: 20px;
  `)}

  ${mobile(css`
    font-size: 14px;
    margin-bottom: 16px;
  `)}
`;

const RetryButton = styled.button`
  padding: 12px 24px;
  background-color: ${colors.primary};
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  font-family: "Montserrat", sans-serif;

  &:hover {
    background-color: ${colors.hoverDark};
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.98);
  }

  ${laptop(css`
    padding: 10px 20px;
    font-size: 15px;
  `)}

  ${mobile(css`
    padding: 8px 16px;
    font-size: 14px;
  `)}
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 20px;

  ${laptop(css`
    margin-bottom: 18px;
    gap: 16px;
  `)}

  ${tablet(css`
    margin-bottom: 16px;
    gap: 14px;
  `)}

  ${mobile(css`
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  `)}
`;

// New styled components for delete functionality
const DeleteIconButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: ${colors.error}15;
  color: ${colors.error};
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-left: 8px;

  &:hover {
    background-color: ${colors.error}30;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  ${mobile(css`
    width: 32px;
    height: 32px;
  `)}
`;

const ActionCell = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  ${mobile(css`
    justify-content: flex-start;
    width: 100%;
    padding-top: 8px;
    border-top: 1px solid ${colors.divider};
  `)}
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background-color: ${colors.card};
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  ${laptop(css`
    padding: 20px;
  `)}

  ${mobile(css`
    padding: 16px;
  `)}
`;

const ModalTitle = styled.h2`
  color: ${colors.error};
  margin-bottom: 16px;
  font-family: "Montserrat", sans-serif;
  font-size: 20px;

  ${mobile(css`
    font-size: 18px;
  `)}
`;

const ModalMessage = styled.p`
  color: ${colors.textPrimary};
  margin-bottom: 24px;
  line-height: 1.5;
  font-size: 15px;

  ${mobile(css`
    font-size: 14px;
  `)}
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;

  ${mobile(css`
    flex-direction: column;
    gap: 8px;
  `)}
`;

const ModalButton = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: "Montserrat", sans-serif;
  border: none;

  ${mobile(css`
    padding: 8px 16px;
    font-size: 14px;
    width: 100%;
  `)}
`;

const CancelButton = styled(ModalButton)`
  background-color: ${colors.background};
  color: ${colors.textPrimary};

  &:hover {
    background-color: ${colors.divider};
  }
`;

const ConfirmDeleteButton = styled(ModalButton)`
  background-color: ${colors.error};
  color: white;

  &:hover {
    background-color: #d32f2f;
    transform: scale(1.02);
  }
`;

const DeleteButton = styled.button`
  padding: 8px 16px;
  background-color: ${colors.error}15;
  color: ${colors.error};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${colors.error}30;
  }

  ${mobile(css`
    padding: 6px 12px;
    font-size: 13px;
  `)}
`;

const client = JSON.parse(localStorage.getItem("loggedInClient"));

const EmployeeApp = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const companyCode = String(client?.companyCode || "").trim().toLowerCase();
  const tenantOrigin = companyCode ? API_BASE_URL : "";
  const fallbackOrigin = API_BASE_URL;

  const buildApiUrl = (origin, path) => `${origin}${path}`;
  const isNetworkFailure = (error) =>
    error?.name === "TypeError" ||
    error?.message?.includes("Failed to fetch") ||
    error?.message?.includes("Network");

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

  const getSafeImageUrl = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== "string") return "";
    return resolveBackendAssetUrl(imageUrl);
  };

  const formatLeavePolicyType = (value) => {
    if (!value) return "Not configured";
    const raw = String(value).trim();
    if (!raw) return "Not configured";
    if (raw.toUpperCase() === "WEEKEND_OFF") return "Weekend Off";
    if (raw.toUpperCase() === "WEEKOFF") return "Week Off";
    return raw
      .toLowerCase()
      .split(/[\s_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatAdditionalWorkingDayLabel = (day) => {
    const rawLabel = String(day?.label || "").trim();
    if (rawLabel) return rawLabel;
    const rawType = String(day?.dayType || "").trim();
    if (!rawType) return "Additional Working Day";
    return rawType
      .toLowerCase()
      .split(/[\s_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatAdditionalWorkingDays = (days) => {
    if (!Array.isArray(days) || days.length === 0) {
      return "Not configured";
    }
    return days
      .map((day) => {
        const label = formatAdditionalWorkingDayLabel(day);
        const timeIn = String(day?.timeIn || "").trim();
        const timeOut = String(day?.timeOut || "").trim();
        const window = timeIn && timeOut ? `${timeIn} - ${timeOut}` : "Time not configured";
        return `${label} (${window})`;
      })
      .join(", ");
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

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

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithTenantFallback(
        `/api/employees?clientId=${client?.id}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees =
    branchFilter === "all"
      ? employees
      : employees.filter(
          (emp) => emp.branch.toLowerCase() === branchFilter.toLowerCase()
        );

  const fetchEmployeeDetails = async (id) => {
    const listEmployee = employees.find((emp) => emp.id === id);
    setSelectedEmployee(listEmployee || null);
    setView("details");

    try {
      const detailResponse = await fetchWithTenantFallback(
        `/api/employees/${id}?clientId=${client?.id}`
      );

      if (!detailResponse.ok) {
        throw new Error(`Failed to fetch employee details: ${detailResponse.status}`);
      }

      const detailData = await detailResponse.json();
      let additionalWorkingDays = Array.isArray(detailData?.additionalWorkingDays)
        ? detailData.additionalWorkingDays
        : [];

      if (additionalWorkingDays.length === 0) {
        const additionalDaysResponse = await fetchWithTenantFallback(
          `/api/employees/${id}/additional-working-days?clientId=${client?.id}`
        );
        if (additionalDaysResponse.ok) {
          const additionalDaysData = await additionalDaysResponse.json();
          additionalWorkingDays = Array.isArray(additionalDaysData)
            ? additionalDaysData
            : [];
        }
      }

      setSelectedEmployee({
        ...(detailData || {}),
        additionalWorkingDays,
      });
    } catch (err) {
      console.error("Error fetching employee detail payload:", err);
    }
  };

  
  const handleEditEmployee = (employee, e) => {
    if (e) {
      e.stopPropagation();
    }
    navigate(`/add-employee/${employee.id}`);
  };
  const handleDeleteClick = (employee, e) => {
    e.stopPropagation();
    setEmployeeToDelete(employee);
    setDeleteModalOpen(true);
  };

  const deleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      setDeleting(true);
      
      // Make DELETE request to your API endpoint
      const response = await fetchWithTenantFallback(
        `/api/employees/${employeeToDelete.id}?clientId=${client?.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const backendMessage = await response.text();
        const suffix = backendMessage ? ` - ${backendMessage}` : "";
        throw new Error(`Failed to delete employee: ${response.status}${suffix}`);
      }

      // Remove employee from local state
      setEmployees(prevEmployees => 
        prevEmployees.filter(emp => emp.id !== employeeToDelete.id)
      );

      // If we were viewing the deleted employee's details, go back to list
      if (selectedEmployee && selectedEmployee.id === employeeToDelete.id) {
        setView("list");
        setSelectedEmployee(null);
      }

      // Close modal
      setDeleteModalOpen(false);
      setEmployeeToDelete(null);
      
    } catch (err) {
      console.error("Error deleting employee:", err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const renderHeader = () => (
    <HeaderRow>
      <HeaderText style={{ flex: 1.5 }}>Profile</HeaderText>
      <HeaderText style={{ flex: 0.8 }}>Employee Code</HeaderText>
      <HeaderText style={{ flex: 1.2 }}>Phone</HeaderText>
      <HeaderText style={{ flex: 1 }}>Gender</HeaderText>
      <HeaderText style={{ flex: 1.2 }}>Branch</HeaderText>
      <HeaderText style={{ flex: 0.5 }}>Actions</HeaderText>
    </HeaderRow>
  );

  const renderEmployeeList = () => (
    <Container>
      <HeaderContainer>
        <Title>Employee Directory</Title>
        <FilterContainer>
          <FaFilter color={colors.textSecondary} />
          <FilterSelect
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">All Branches</option>
            {branches.map((branch, index) => (
              <option key={index} value={branch}>
                {branch}
              </option>
            ))}
          </FilterSelect>
        </FilterContainer>
      </HeaderContainer>

      <TableContainer>
        {renderHeader()}
        <ListContainer>
          {filteredEmployees.map((item, index) => (
            (() => {
              const imageUrl = getSafeImageUrl(item.profileImage);
              return (
            <Row
              key={item.id}
              $isEven={index % 2 === 0}
              onClick={() => fetchEmployeeDetails(item.id)}
            >
              <ProfileContainer style={{ flex: 1.5 }}>
                <ProfileImage>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`${item.firstName} ${item.lastName}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <FaUser color={colors.primary} size={16} />
                  )}
                </ProfileImage>
                <ProfileName>{`${item.firstName} ${item.lastName}`}</ProfileName>
              </ProfileContainer>
              <CellText style={{ flex: 0.8 }}>
                <MobileLabel>Employee Code:</MobileLabel>
                {item.employeeCode || item.id}
              </CellText>
              <CellText style={{ flex: 1.2 }}>
                <MobileLabel>Phone:</MobileLabel>
                {item.mobile}
              </CellText>
              <CellText style={{ flex: 1 }}>
                <MobileLabel>Gender:</MobileLabel>
                {item.gender}
              </CellText>
              <CellText style={{ flex: 1.2 }}>
                <MobileLabel>Branch:</MobileLabel>
                {item.branch}
              </CellText>
              <ActionCell style={{ flex: 0.5 }}>
                <DeleteIconButton
                  onClick={(e) => handleEditEmployee(item, e)}
                  title="Edit Employee"
                  style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}
                >
                  <FaEdit size={14} />
                </DeleteIconButton>
                <DeleteIconButton
                  onClick={(e) => handleDeleteClick(item, e)}
                  title="Delete Employee"
                >
                  <FaTrash size={14} />
                </DeleteIconButton>
              </ActionCell>
            </Row>
              );
            })()
          ))}
        </ListContainer>
      </TableContainer>
    </Container>
  );

  const renderEmployeeDetails = () => {
    if (!selectedEmployee) return null;

    const employee = selectedEmployee;
    const fullName = `${employee.firstName} ${employee.lastName}`;
    const imageUrl = getSafeImageUrl(employee.profileImage);

    return (
      <Container>
        <BackButton onClick={() => setView("list")}>
          <BackIcon />
          <BackButtonText>Back to Employees</BackButtonText>
        </BackButton>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <Header>
            <AvatarContainer>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={fullName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <FaUserCircle size={40} color={colors.primary} />
              )}
            </AvatarContainer>
            <div>
              <Title>{fullName}</Title>
              <Subtitle>{employee.position}</Subtitle>
              <Company>{employee.branch}</Company>
              <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <DeleteButton
                  onClick={() => handleEditEmployee(employee)}
                  style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}
                >
                  <FaEdit /> Edit Employee
                </DeleteButton>
                <DeleteButton
                  onClick={() => {
                    setEmployeeToDelete(employee);
                    setDeleteModalOpen(true);
                  }}
                >
                  <FaTrash /> Delete Employee
                </DeleteButton>
              </div>
            </div>
          </Header>

          <TwoColumnContainer>
            <DetailColumn>
              <Section>
                <SectionHeader>
                  <SectionIcon>
                    <FaUserAlt />
                  </SectionIcon>
                  <SectionTitle>Personal Information</SectionTitle>
                </SectionHeader>

                <DetailRowTable>
                  <IconContainer>
                    <FaIdBadge />
                  </IconContainer>
                  <Label>Employee ID</Label>
                  <Value>{employee.employeeCode || employee.id}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaVenusMars />
                  </IconContainer>
                  <Label>Gender</Label>
                  <Value>{employee.gender}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaCalendarAlt />
                  </IconContainer>
                  <Label>Date of Birth</Label>
                  <Value>{employee.dob}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <MdWeekend />
                  </IconContainer>
                  <Label>Week Off</Label>
                  <Value>{employee.weekOff || "Not configured"}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaInfoCircle />
                  </IconContainer>
                  <Label>Leave Policy</Label>
                  <Value>{formatLeavePolicyType(employee.leavePolicyType)}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <MdWeekend />
                  </IconContainer>
                  <Label>Additional Working Days</Label>
                  <Value>{formatAdditionalWorkingDays(employee.additionalWorkingDays)}</Value>
                </DetailRowTable>
              </Section>

              <Section>
                <SectionHeader>
                  <SectionIcon>
                    <FaBriefcase />
                  </SectionIcon>
                  <SectionTitle>Professional Information</SectionTitle>
                </SectionHeader>

                <DetailRowTable>
                  <IconContainer>
                    <MdEngineering />
                  </IconContainer>
                  <Label>Position</Label>
                  <Value>{employee.position}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaMoneyBillAlt />
                  </IconContainer>
                  <Label>Salary</Label>
                  <Value>{employee.salary}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaBuilding />
                  </IconContainer>
                  <Label>Branch</Label>
                  <Value>{employee.branch}</Value>
                </DetailRowTable>
              </Section>
            </DetailColumn>

            <DetailColumn>
              <Section>
                <SectionHeader>
                  <SectionIcon>
                    <FaPhone />
                  </SectionIcon>
                  <SectionTitle>Contact Information</SectionTitle>
                </SectionHeader>

                <DetailRowTable>
                  <IconContainer>
                    <FaMobileAlt />
                  </IconContainer>
                  <Label>Mobile</Label>
                  <Value>{employee.mobile}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaEnvelope />
                  </IconContainer>
                  <Label>Email</Label>
                  <Value>{employee.email}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaMobile />
                  </IconContainer>
                  <Label>Alt. Mobile</Label>
                  <Value>{employee.alternativeMobile}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaHome />
                  </IconContainer>
                  <Label>Address</Label>
                  <Value>{employee.address}</Value>
                </DetailRowTable>
              </Section>

              <Section>
                <SectionHeader>
                  <SectionIcon>
                    <FaInfoCircle />
                  </SectionIcon>
                  <SectionTitle>Additional Information</SectionTitle>
                </SectionHeader>

                <DetailRowTable>
                  <IconContainer>
                    <FaUser />
                  </IconContainer>
                  <Label>Username</Label>
                  <Value>{employee.username}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaCalendarAlt />
                  </IconContainer>
                  <Label>Date of Joining</Label>
                  <Value>{employee.dateOfJoining}</Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <MdPersonPin />
                  </IconContainer>
                  <Label>Profile Image</Label>
                  <Value>
                    {employee.profileImage ? "Uploaded" : "Not available"}
                  </Value>
                </DetailRowTable>
                <DetailRowTable>
                  <IconContainer>
                    <FaInfoCircle />
                  </IconContainer>
                  <Label>Reset Token</Label>
                  <Value>{employee.resetToken || "N/A"}</Value>
                </DetailRowTable>
              </Section>
            </DetailColumn>
          </TwoColumnContainer>
        </div>
      </Container>
    );
  };

  const renderDeleteModal = () => {
    if (!deleteModalOpen || !employeeToDelete) return null;

    const employeeName = `${employeeToDelete.firstName} ${employeeToDelete.lastName}`;

    return (
      <ModalOverlay onClick={() => !deleting && setDeleteModalOpen(false)}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <ModalTitle>Delete Employee</ModalTitle>
          <ModalMessage>
            Are you sure you want to delete <strong>{employeeName}</strong> (Employee Code: {employeeToDelete?.employeeCode || employeeToDelete?.id})?
            <br /><br />
            This action cannot be undone. All employee data including personal information, contact details, and professional records will be permanently removed.
          </ModalMessage>
          <ModalActions>
            <CancelButton
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </CancelButton>
            <ConfirmDeleteButton
              onClick={deleteEmployee}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Employee"}
            </ConfirmDeleteButton>
          </ModalActions>
        </ModalContent>
      </ModalOverlay>
    );
  };

  if (error) {
    return (
      <ErrorContainer>
        <ErrorText>Error loading employee data: {error}</ErrorText>
        <RetryButton onClick={fetchEmployees}>
          Retry
        </RetryButton>
      </ErrorContainer>
    );
  }

  if (loading) {
    return (
      <LoaderContainer>
        <Loader>Loading...</Loader>
      </LoaderContainer>
    );
  }

  return (
    <>
      {view === "list" ? renderEmployeeList() : renderEmployeeDetails()}
      {renderDeleteModal()}
    </>
  );
};

export default EmployeeApp;














