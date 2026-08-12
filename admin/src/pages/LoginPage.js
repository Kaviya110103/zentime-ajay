import React, { useState } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Snackbar,
  IconButton,
  CssBaseline,
  AppBar,
  Toolbar,
  Box,
  useMediaQuery,
  ThemeProvider,
  createTheme,
  InputAdornment,
} from "@mui/material";
import {
  Close as CloseIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, fetchWithTimeout } from "../config/api";

const baseTheme = createTheme({
  palette: {
    primary: { main: "#351153", contrastText: "#fff" },
    secondary: { main: "#4B2C74", contrastText: "#fff" },
    success: { main: "#4CAF50" },
    error: { main: "#F44336" },
    background: { default: "#F5F5F5", paper: "#fff" },
  },
  typography: {
    fontFamily: '"Open Sans", sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
});

const theme = createTheme(baseTheme, {
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            "&.Mui-focused fieldset": {
              borderColor: "#351153",
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&:hover": { transform: "scale(1.02)" },
        },
      },
    },
  },
});

export default function LoginPage() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };
  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };
  const handleLogin = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/clients/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const userData = await res.json(); // 👈 parse response (your API should return the logged-in client object)

        // store in localStorage
        localStorage.setItem("AdminActive", "true");
        localStorage.setItem("loggedInClient", JSON.stringify(userData));

        showSnackbar("Login successful", "success");

        setTimeout(() => {
          navigate("/AdminDashboard");
        }, 1000);
      } else {
        showSnackbar("Invalid credentials", "error");
      }
    } catch (err) {
      showSnackbar("Server error", "error");
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading || !form.username || !form.password) {
      return;
    }
    handleLogin();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Admin Login
          </Typography>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="sm"
        sx={{
          minHeight: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 3, sm: 4 },
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            width: "100%",
            maxWidth: 560,
            backgroundColor: "background.paper",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            boxShadow: "0 18px 44px rgba(0,0,0,0.16)",
          }}
        >
          <Typography variant="h5" gutterBottom>
            Login
          </Typography>

          <TextField
            fullWidth
            label="Username"
            name="username"
            margin="normal"
            value={form.username}
            onChange={handleChange}
          />

          <TextField
            fullWidth
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            margin="normal"
            value={form.password}
            onChange={handleChange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            disabled={loading || !form.username || !form.password}
            sx={{ mt: 3 }}
            startIcon={<LockIcon />}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </Box>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{
          vertical: isMobile ? "top" : "top",
          horizontal: isMobile ? "center" : "center",
        }}
        message={snackbar.message}
        action={
          <IconButton color="inherit" onClick={handleCloseSnackbar}>
            <CloseIcon />
          </IconButton>
        }
        ContentProps={{
          sx: {
            backgroundColor:
              snackbar.severity === "success"
                ? theme.palette.success.main
                : snackbar.severity === "error"
                ? theme.palette.error.main
                : theme.palette.primary.main,
            borderRadius: "8px",
          },
        }}
      />
    </ThemeProvider>
  );
}



