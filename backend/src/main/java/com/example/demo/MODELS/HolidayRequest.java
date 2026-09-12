package com.example.demo.MODELS;

public class HolidayRequest {
    private Long clientId;
    private String holidayDate;
    private String holidayName;
    private String holidayType;
    private String branchScope;

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public String getHolidayDate() {
        return holidayDate;
    }

    public void setHolidayDate(String holidayDate) {
        this.holidayDate = holidayDate;
    }

    public String getHolidayName() {
        return holidayName;
    }

    public void setHolidayName(String holidayName) {
        this.holidayName = holidayName;
    }

    public String getHolidayType() {
        return holidayType;
    }

    public void setHolidayType(String holidayType) {
        this.holidayType = holidayType;
    }

    public String getBranchScope() {
        return branchScope;
    }

    public void setBranchScope(String branchScope) {
        this.branchScope = branchScope;
    }
}
