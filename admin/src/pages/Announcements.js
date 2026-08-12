import React, { useState, useEffect } from "react";
import axios from "axios";
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
  Avatar,
  LinearProgress,
  Badge,
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
  Sort as SortIcon,
  Notifications as NotificationsIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { API_BASE_URL } from "../config/api";

// First create the base theme without component overrides
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

// Then create the complete theme with component overrides
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
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: "#351153",
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


function App() {
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  const clientId = client?.id;
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [postedBy, setPostedBy] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const API_URL = `${API_BASE_URL}/api/announcements`;

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    if (!clientId) {
      showSnackbar("Client session missing. Please login again.", "error");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(API_URL, { params: { clientId } });
      setAnnouncements(response.data);
      setLoading(false);
    } catch (error) {
      showSnackbar("Failed to fetch announcements");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientId) {
      showSnackbar("Client session missing. Please login again.", "error");
      return;
    }
    const announcementData = { title, message, postedBy };

    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, announcementData, {
          params: { clientId },
        });
        showSnackbar("Announcement updated successfully", "success");
      } else {
        await axios.post(API_URL, announcementData, { params: { clientId } });
        showSnackbar("Announcement created successfully", "success");
      }
      resetForm();
      fetchAnnouncements();
      setOpenDialog(false);
    } catch (error) {
      showSnackbar("Error saving announcement", "error");
    }
  };

  const handleEdit = (announcement) => {
    setTitle(announcement.title);
    setMessage(announcement.message);
    setPostedBy(announcement.postedBy);
    setEditingId(announcement.id);
    setOpenDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this announcement?")) {
      if (!clientId) {
        showSnackbar("Client session missing. Please login again.", "error");
        return;
      }
      try {
        await axios.delete(`${API_URL}/${id}`, { params: { clientId } });
        showSnackbar("Announcement deleted successfully", "success");
        fetchAnnouncements();
      } catch (error) {
        showSnackbar("Error deleting announcement", "error");
      }
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setPostedBy("");
    setEditingId(null);
  };

  const showSnackbar = (message, severity = "info") => {
    setSnackbarMessage({ message, severity });
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  const handleDialogOpen = () => {
    resetForm();
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    resetForm();
  };

  const filteredAnnouncements = announcements
    .filter(
      (announcement) =>
        announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        announcement.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        announcement.postedBy.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.postedDate);
      const dateB = new Date(b.postedDate);
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

  const handleViewDetails = (announcement) => {
    setSelectedAnnouncement(announcement);
    setDetailDialogOpen(true);
  };

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
              Announcement Board Admin
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
              Announcements
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
                placeholder="Search..."
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
                <Tooltip title="Sort by date">
                  <IconButton
                    onClick={() =>
                      setSortBy(sortBy === "newest" ? "oldest" : "newest")
                    }
                    sx={{
                      backgroundColor: "background.paper",
                      "&:hover": {
                        backgroundColor: "secondary.main",
                        color: "white",
                      },
                    }}
                  >
                    <SortIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Refresh">
                  <IconButton
                    onClick={fetchAnnouncements}
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
                    New Announcement
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
                  New Announcement
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
          ) : filteredAnnouncements.length === 0 ? (
            <Paper
              sx={{
                p: 4,
                textAlign: "center",
                borderRadius: "12px",
                backgroundColor: "background.paper",
              }}
            >
              <Typography variant="h6" color="text.secondary">
                No announcements found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {searchTerm
                  ? "Try a different search term"
                  : "Create your first announcement to get started"}
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
                Create Announcement
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {filteredAnnouncements.map((announcement) => (
                <Grid
                  item
                  xs={12}
                  sm={isTablet ? 6 : 6}
                  md={4}
                  key={announcement.id}
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
                          justifyContent: "space-between",
                          mb: 1,
                        }}
                      >
                        <Chip
                          label={format(
                            new Date(announcement.postedDate),
                            "MMM dd, yyyy"
                          )}
                          size="small"
                          sx={{
                            backgroundColor: "primary.light",
                            color: "white",
                            fontSize: "0.7rem",
                          }}
                        />
                      </Box>
                      <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                        {announcement.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {announcement.message}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          mt: "auto",
                        }}
                      >
                        <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                          {announcement.postedBy.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary">
                          Posted by {announcement.postedBy}
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
                      <Button
                        size="small"
                        onClick={() => handleViewDetails(announcement)}
                        sx={{ color: "primary.main" }}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        startIcon={<EditIcon fontSize="small" />}
                        onClick={() => handleEdit(announcement)}
                        sx={{ color: "secondary.main" }}
                      >
                        {isMobile ? "" : "Edit"}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon fontSize="small" />}
                        onClick={() => handleDelete(announcement.id)}
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

        {/* Create/Edit Announcement Dialog */}
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
            {editingId ? "Edit Announcement" : "Create New Announcement"}
          </DialogTitle>
          <DialogContent sx={{ backgroundColor: "background.paper", pt: 3 }}>
            <form onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                variant="outlined"
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                multiline
                rows={isMobile ? 3 : 4}
                label="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                variant="outlined"
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Posted By"
                value={postedBy}
                onChange={(e) => setPostedBy(e.target.value)}
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
              disabled={!title || !message || !postedBy}
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

        {/* Announcement Detail Dialog */}
        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          maxWidth={isMobile ? "sm" : "md"}
          fullWidth
        >
          {selectedAnnouncement && (
            <>
              <DialogTitle
                sx={{
                  backgroundImage:
                    "linear-gradient(to bottom, #351153, #351153)",
                  color: "white",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant={isMobile ? "h6" : "h5"}>
                    {selectedAnnouncement.title}
                  </Typography>
                  <IconButton
                    onClick={() => setDetailDialogOpen(false)}
                    sx={{ color: "white" }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
                <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                  Posted by {selectedAnnouncement.postedBy} •{" "}
                  {format(
                    new Date(selectedAnnouncement.postedDate),
                    "MMMM dd, yyyy"
                  )}
                </Typography>
              </DialogTitle>
              <DialogContent
                dividers
                sx={{
                  backgroundColor: "background.paper",
                  color: "text.primary",
                  p: isMobile ? 2 : 3,
                }}
              >
                <Typography variant="body1" paragraph>
                  {selectedAnnouncement.message}
                </Typography>
              </DialogContent>
              <DialogActions
                sx={{
                  backgroundColor: "background.paper",
                  flexDirection: isMobile ? "column" : "row",
                  gap: isMobile ? 1 : 0,
                }}
              >
                <Button
                  onClick={() => {
                    handleEdit(selectedAnnouncement);
                    setDetailDialogOpen(false);
                  }}
                  startIcon={<EditIcon />}
                  fullWidth={isMobile}
                  sx={{
                    color: "secondary.main",
                    justifyContent: isMobile ? "flex-start" : "center",
                  }}
                >
                  Edit
                </Button>
                <Button
                  onClick={() => {
                    handleDelete(selectedAnnouncement.id);
                    setDetailDialogOpen(false);
                  }}
                  startIcon={<DeleteIcon />}
                  fullWidth={isMobile}
                  sx={{
                    color: "error.main",
                    justifyContent: isMobile ? "flex-start" : "center",
                  }}
                >
                  Delete
                </Button>
              </DialogActions>
            </>
          )}
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

export default App;





