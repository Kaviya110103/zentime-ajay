import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import {
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  IconButton,
  AppBar,
  Toolbar,
  Box,
  Paper,
  LinearProgress,
  Tooltip,
  Fab,
  createTheme,
  ThemeProvider,
  CssBaseline,
  Chip,
  useMediaQuery,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  LocationOn as LocationIcon,
  MyLocation as MyLocationIcon,
} from "@mui/icons-material";

// eslint-disable-next-line no-template-curly-in-string

const initialForm = {
  latitude: "",
  longitude: "",
  name: "",
  address: "",
  radius: "",
};

const baseTheme = createTheme({
  palette: {
    primary: {
      main: "#351153",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#351153",
      contrastText: "#ffffff",
    },
    success: {
      main: "#4CAF50",
    },
    error: {
      main: "#F44336",
    },
    warning: {
      main: "#FFC107",
    },
    info: {
      main: "#2196F3",
    },
    background: {
      default: "#F5F5F5",
      paper: "#ffffff",
    },
    text: {
      primary: "#212121",
      secondary: "#757575",
    },
  },
  typography: {
    fontFamily: '"Open Sans", sans-serif',
    h1: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700 },
    h2: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700 },
    h3: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700 },
    h4: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700 },
    h6: { fontFamily: '"Montserrat", sans-serif', fontWeight: 700 },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
});
const theme = createTheme(baseTheme, {
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          boxShadow: "0px 3px 6px rgba(0, 0, 0, 0.1)",
          transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0px 6px 12px rgba(0, 0, 0, 0.15)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            transform: "scale(1.02)",
          },
          "&:active": {
            transform: "scale(0.98)",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: "8px",
            "&.Mui-focused fieldset": {
              borderWidth: "2px",
              borderColor: "#351153",
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "12px",
          [baseTheme.breakpoints.down("sm")]: {
            margin: "8px",
            width: "calc(100% - 16px)",
          },
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          [baseTheme.breakpoints.down("sm")]: {
            bottom: 70,
          },
        },
      },
    },
  },
});

export default function LocationSet() {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFetchingCurrentLocation, setIsFetchingCurrentLocation] = useState(false);
const client = JSON.parse(localStorage.getItem("loggedInClient")); 
const companyCode = String(client?.companyCode || "").trim().toLowerCase();
const tenantOrigin = companyCode ? API_BASE_URL : "";
const fallbackOrigin = API_BASE_URL;
const API_PATH = "/api/locations";

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
const scopedClientId = client?.id;
const scopedSuffix = scopedClientId ? `?clientId=${scopedClientId}` : "";

  const buildApiUrl = (origin, path) => `${origin}${path}`;
  const shouldRetryWithFallback = (error) =>
    !error?.response && error?.code === "ERR_NETWORK";

  const axiosRequestWithFallback = async (config) => {
    const primaryConfig = {
      ...config,
      url: buildApiUrl(tenantOrigin || fallbackOrigin, config.url),
    };
    try {
      return await axios(primaryConfig);
    } catch (error) {
      if (tenantOrigin && shouldRetryWithFallback(error)) {
        return axios({
          ...config,
          url: buildApiUrl(fallbackOrigin, config.url),
        });
      }
      throw error;
    }
  };

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
      setLoading(true);
    try {
      const res = await axiosRequestWithFallback({
        method: "GET",
        url: `${API_PATH}${scopedSuffix}`,
      });
      setLocations(res.data);
      setLoading(false);
    } catch (err) {
      showSnackbar("Failed to fetch locations", "error");
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      name: form.name,
      address: form.address,
      radius: parseFloat(form.radius),
    };

    try {
      if (editingId) {
        await axiosRequestWithFallback({
          method: "PUT",
          url: `${API_PATH}/${editingId}${scopedSuffix}`,
          data,
        });
        showSnackbar("Location updated successfully", "success");
      } else {
        await axiosRequestWithFallback({
          method: "POST",
          url: `${API_PATH}${scopedSuffix}`,
          data: { ...data, clientId: scopedClientId },
        });
        showSnackbar("Location created successfully", "success");
      }
      setForm(initialForm);
      setEditingId(null);
      setOpenDialog(false);
      fetchLocations();
    } catch (err) {
      showSnackbar("Error saving location", "error");
    }
  };

  const handleEdit = (loc) => {
    setForm(loc);
    setEditingId(loc.id);
    setOpenDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this location?")) {
      try {
        await axiosRequestWithFallback({
          method: "DELETE",
          url: `${API_PATH}/${id}${scopedSuffix}`,
        });
        showSnackbar("Location deleted successfully", "success");
        fetchLocations();
      } catch (err) {
        showSnackbar("Error deleting location", "error");
      }
    }
  };

  const handleDialogOpen = () => {
    setForm(initialForm);
    setEditingId(null);
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setForm(initialForm);
    setEditingId(null);
  };

  const showSnackbar = (message, severity = "info") => {
    setSnackbarMessage({ message, severity });
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  const handleUseCurrentLocation = () => {
    if (!window.confirm("Allow this page to fetch your current location?")) {
      return;
    }

    if (!navigator.geolocation) {
      showSnackbar("Geolocation is not supported in this browser", "error");
      return;
    }

    setIsFetchingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setForm((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
        setIsFetchingCurrentLocation(false);
        showSnackbar("Latitude and longitude auto-filled", "success");
      },
      (error) => {
        setIsFetchingCurrentLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          showSnackbar("Location permission denied", "error");
          return;
        }
        if (error.code === error.TIMEOUT) {
          showSnackbar("Timed out while fetching current location", "error");
          return;
        }
        showSnackbar("Unable to fetch current location", "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const filteredLocations = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div>
        <AppBar
          position="static"
          elevation={0}
          sx={{ backgroundColor: "primary.main" }}
        >
          <Toolbar>
            <Typography
              variant={isMobile ? "h6" : "h5"}
              component="div"
              sx={{ flexGrow: 1, color: "white" }}
            >
              Branch Location Management${client.companyCode}
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              mb: 4,
              gap: isMobile ? 2 : 0,
            }}
          >
            <Typography variant={isMobile ? "h5" : "h4"} component="h1">
              Branch Geofence Locations
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                width: isMobile ? "100%" : "auto",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <TextField
                size="small"
                placeholder="Search locations..."
                variant="outlined"
                fullWidth={isMobile}
                InputProps={{
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  backgroundColor: "background.paper",
                  borderRadius: "8px",
                  minWidth: isMobile ? "100%" : "300px",
                }}
              />
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  width: isMobile ? "100%" : "auto",
                  justifyContent: isMobile ? "space-between" : "flex-start",
                }}
              >
                <Tooltip title="Refresh">
                  <IconButton
                    onClick={fetchLocations}
                    sx={{
                      backgroundColor: "background.paper",
                      "&:hover": {
                        backgroundColor: "secondary.main",
                        color: "white",
                      },
                    }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                {!isMobile && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleDialogOpen}
                    sx={{
                      backgroundColor: "primary.main",
                      "&:hover": { backgroundColor: "secondary.main" },
                    }}
                  >
                    New Location
                  </Button>
                )}
              </Box>
              {isMobile && (
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<AddIcon />}
                  onClick={handleDialogOpen}
                  sx={{
                    backgroundColor: "primary.main",
                    "&:hover": { backgroundColor: "secondary.main" },
                  }}
                >
                  New Location
                </Button>
              )}
              <Fab
                color="primary"
                aria-label="add"
                onClick={handleDialogOpen}
                sx={{
                  display: { xs: "none", sm: "none" },
                  position: "fixed",
                  bottom: 16,
                  right: 16,
                  backgroundColor: "primary.main",
                  "&:hover": { backgroundColor: "secondary.main" },
                }}
              >
                <AddIcon />
              </Fab>
            </Box>
          </Box>

          {loading ? (
            <LinearProgress color="secondary" />
          ) : filteredLocations.length === 0 ? (
            <Paper
              sx={{
                p: 4,
                textAlign: "center",
                borderRadius: "12px",
                backgroundColor: "background.paper",
              }}
            >
              <Typography variant="h6" color="text.secondary">
                No locations found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {searchTerm
                  ? "Try a different search term"
                  : "Create your first location to get started"}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleDialogOpen}
                sx={{
                  backgroundColor: "primary.main",
                  "&:hover": { backgroundColor: "secondary.main" },
                }}
              >
                Create Location
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {filteredLocations.map((location) => (
                <Grid
                  item
                  xs={12}
                  sm={isTablet ? 6 : 6}
                  md={4}
                  key={location.id}
                >
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          mb: 1,
                        }}
                      >
                        <LocationIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" component="h3">
                          {location.name}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {location.address}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Chip
                          label={`Lat: ${location.latitude}`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`Lng: ${location.longitude}`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Chip
                        label={`Radius: ${location.radius}m`}
                        size="small"
                        color="primary"
                        sx={{ backgroundColor: "primary.main", color: "white" }}
                      />
                    </CardContent>
                    <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon fontSize="small" />}
                        onClick={() => handleEdit(location)}
                        sx={{ color: "secondary.main" }}
                      >
                        {isMobile ? "" : "Edit"}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon fontSize="small" />}
                        onClick={() => handleDelete(location.id)}
                        sx={{ color: "error.main" }}
                      >
                        {isMobile ? "" : "Delete"}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>

        {/* Create/Edit Location Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleDialogClose}
          fullWidth
          maxWidth={isMobile ? "xs" : "sm"}
        >
          <DialogTitle
            sx={{
              backgroundImage: "linear-gradient(to bottom, #351153, #351153)",
              color: "white",
            }}
          >
            {editingId ? "Edit Location" : "Create New Location"}
          </DialogTitle>
          <DialogContent sx={{ backgroundColor: "background.paper", pt: 3 }}>
            <form onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Branch Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                variant="outlined"
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Address"
                name="address"
                value={form.address}
                onChange={handleChange}
                variant="outlined"
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  type="number"
                  label="Latitude"
                  name="latitude"
                  value={form.latitude}
                  onChange={handleChange}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  type="number"
                  label="Longitude"
                  name="longitude"
                  value={form.longitude}
                  onChange={handleChange}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<MyLocationIcon />}
                  onClick={handleUseCurrentLocation}
                  disabled={isFetchingCurrentLocation}
                  sx={{
                    borderColor: "primary.main",
                    color: "primary.main",
                    "&:hover": {
                      borderColor: "secondary.main",
                      color: "secondary.main",
                    },
                  }}
                >
                  {isFetchingCurrentLocation
                    ? "Fetching current location..."
                    : "Use Current Location"}
                </Button>
              </Box>
              <TextField
                margin="normal"
                required
                fullWidth
                type="number"
                label="Radius (meters)"
                name="radius"
                value={form.radius}
                onChange={handleChange}
                variant="outlined"
                sx={{ mb: 2 }}
              />
            </form>
          </DialogContent>
          <DialogActions
            sx={{
              p: 3,
              backgroundColor: "background.paper",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 1 : 0,
            }}
          >
            <Button
              onClick={handleDialogClose}
              variant="outlined"
              fullWidth={isMobile}
              sx={{
                mr: isMobile ? 0 : 2,
                borderColor: "primary.main",
                color: "primary.main",
                "&:hover": {
                  borderColor: "secondary.main",
                  color: "secondary.main",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              fullWidth={isMobile}
              disabled={
                !form.name ||
                !form.address ||
                !form.latitude ||
                !form.longitude ||
                !form.radius
              }
              sx={{
                px: isMobile ? 0 : 4,
                backgroundColor: "primary.main",
                "&:hover": { backgroundColor: "secondary.main" },
                "&:disabled": { backgroundColor: "text.disabled" },
              }}
            >
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={openSnackbar}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{
            vertical: isMobile ? "bottom" : "bottom",
            horizontal: isMobile ? "center" : "right",
          }}
          sx={{
            [theme.breakpoints.down("sm")]: {
              bottom: 70,
            },
            "& .MuiSnackbarContent-root": {
              backgroundColor:
                snackbarMessage.severity === "error"
                  ? theme.palette.error.main
                  : snackbarMessage.severity === "success"
                  ? theme.palette.success.main
                  : theme.palette.primary.main,
              color: "white",
              borderRadius: "8px",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography sx={{ mr: 2 }}>{snackbarMessage.message}</Typography>
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={handleCloseSnackbar}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Snackbar>
      </div>
    </ThemeProvider>
  );
}





