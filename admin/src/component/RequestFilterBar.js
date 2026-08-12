import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";

export default function RequestFilterBar({
  clientId,
  selectedMonth,
  selectedBranch,
  onMonthChange,
  onBranchChange,
  onRefresh,
  refreshing = false,
}) {
  const [branchOptions, setBranchOptions] = useState([]);

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setBranchOptions([]);
      return undefined;
    }

    fetchBranchesFromLocationSet(clientId)
      .then((branches) => {
        if (active) setBranchOptions(Array.isArray(branches) ? branches : []);
      })
      .catch(() => {
        if (active) setBranchOptions([]);
      });

    return () => {
      active = false;
    };
  }, [clientId]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: "1px solid rgba(53, 17, 83, 0.12)",
          background: "#fff",
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <DatePicker
              views={["year", "month"]}
              label="Select Month & Year"
              value={selectedMonth}
              onChange={onMonthChange}
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel shrink>Branch</InputLabel>
              <Select
                value={selectedBranch}
                onChange={(event) => onBranchChange(event.target.value)}
                label="Branch"
                displayEmpty
                notched
                renderValue={(selected) => selected || "All Branches"}
              >
                <MenuItem value="">All Branches</MenuItem>
                {branchOptions.map((branch) => (
                  <MenuItem key={branch} value={branch}>
                    {branch}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={onRefresh}
                disabled={refreshing}
                sx={{ backgroundColor: "#351153", "&:hover": { backgroundColor: "#5a2d8a" } }}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </LocalizationProvider>
  );
}
