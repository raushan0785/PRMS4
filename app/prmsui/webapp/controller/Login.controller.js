sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
  "use strict";

  return Controller.extend("prmsui.controller.Login", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        username: "emp01",
        password: "welcome123"
      }), "login");

      // Ensure users data is loaded
      var oUsersModel = this.getOwnerComponent().getModel("users");
      if (!oUsersModel.getProperty("/users") || oUsersModel.getProperty("/users").length === 0) {
        oUsersModel.loadData("model/mockUsers.json");
      }

      if (this.getOwnerComponent().getModel("session").getProperty("/authenticated")) {
        this.getOwnerComponent().getRouter().navTo(this._getHomeRoute(this.getOwnerComponent().getModel("session").getProperty("/role")));
      }
    },

    onLogin: function () {
      var oLoginModel = this.getView().getModel("login");
      var oUsersModel = this.getOwnerComponent().getModel("users");
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var sUsername = oLoginModel.getProperty("/username");
      var sPassword = oLoginModel.getProperty("/password");
      var aUsers = oUsersModel.getProperty("/users") || [];

      console.log("Login attempt:", sUsername, "Users available:", aUsers.length);

      var oUser = aUsers.find(function (oEntry) {
        return oEntry.username === sUsername && oEntry.password === sPassword;
      });

      if (!oUser) {
        console.log("User not found or password incorrect");
        MessageBox.error("Invalid credentials. Use one of the provided demo users.");
        return;
      }

      console.log("User authenticated:", oUser.fullName, "Role:", oUser.role);

      var oSessionData = {
        authenticated: true,
        user: oUser.username,
        fullName: oUser.fullName,
        role: oUser.role,
        employeeId: oUser.employeeId,
        teamMemberIds: oUser.teamMemberIds || [],
        appraisalCycle: "Jan 2026 - Dec 2026",
        isEmployee: oUser.role === "Employee",
        isManager: oUser.role === "Manager",
        isHRAdmin: oUser.role === "HR" || oUser.role === "Admin"
      };

      oSessionModel.setData(oSessionData);
      window.sessionStorage.setItem("PRMS_SESSION", JSON.stringify(oSessionData));

      console.log("Session saved. Navigating to dashboard...");
      this.getOwnerComponent().getRouter().navTo(this._getHomeRoute(oUser.role));
    },

    _getHomeRoute: function (sRole) {
      if (sRole === "Manager") {
        return "manager";
      }

      if (sRole === "HR" || sRole === "Admin") {
        return "hr";
      }

      return "employee";
    }
  });
});
 
