// sap.ui.define([
//   "sap/ui/core/mvc/Controller",
//   "sap/ui/model/json/JSONModel",
//   "sap/m/MessageBox"
// ], function (Controller, JSONModel, MessageBox) {
//   "use strict";

//   return Controller.extend("prmsui.controller.Login", {
//     onInit: function () {
//       this.getView().setModel(new JSONModel({
//         username: "emp01",
//         password: "welcome123"
//       }), "login");

//       // Ensure users data is loaded
//       var oUsersModel = this.getOwnerComponent().getModel("users");
//       if (!oUsersModel.getProperty("/users") || oUsersModel.getProperty("/users").length === 0) {
//         oUsersModel.loadData("model/mockUsers.json");
//       }

//       if (this.getOwnerComponent().getModel("session").getProperty("/authenticated")) {
//         this.getOwnerComponent().getRouter().navTo(this._getHomeRoute(this.getOwnerComponent().getModel("session").getProperty("/role")));
//       }
//     },

//     onLogin: function () {
//       var oLoginModel = this.getView().getModel("login");
//       var oUsersModel = this.getOwnerComponent().getModel("users");
//       var oSessionModel = this.getOwnerComponent().getModel("session");
//       var sUsername = oLoginModel.getProperty("/username");
//       var sPassword = oLoginModel.getProperty("/password");
//       var aUsers = oUsersModel.getProperty("/users") || [];

//       console.log("Login attempt:", sUsername, "Users available:", aUsers.length);

//       var oUser = aUsers.find(function (oEntry) {
//         return oEntry.username === sUsername && oEntry.password === sPassword;
//       });

//       if (!oUser) {
//         console.log("User not found or password incorrect");
//         MessageBox.error("Invalid credentials. Use one of the provided demo users.");
//         return;
//       }

//       console.log("User authenticated:", oUser.fullName, "Role:", oUser.role);

//       var oSessionData = {
//         authenticated: true,
//         user: oUser.username,
//         fullName: oUser.fullName,
//         role: oUser.role,
//         employeeId: oUser.employeeId,
//         teamMemberIds: oUser.teamMemberIds || [],
//         appraisalCycle: "Jan 2026 - Dec 2026",
//         isEmployee: oUser.role === "Employee",
//         isManager: oUser.role === "Manager",
//         isHRAdmin: oUser.role === "HR" || oUser.role === "Admin"
//       };

//       oSessionModel.setData(oSessionData);
//       window.sessionStorage.setItem("PRMS_SESSION", JSON.stringify(oSessionData));

//       console.log("Session saved. Navigating to dashboard...");
//       this.getOwnerComponent().getRouter().navTo(this._getHomeRoute(oUser.role));
//     },

//     _getHomeRoute: function (sRole) {
//       if (sRole === "Manager") {
//         return "manager";
//       }

//       if (sRole === "HR" || sRole === "Admin") {
//         return "hr";
//       }

//       return "employee";
//     }
//   });
// });
 


sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
  "use strict";

  return Controller.extend("prmsui.controller.Login", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        emailId: "",
        otp: "",
        generatedOtp: "",
        otpSent: false
      }), "login");

      if (this.getOwnerComponent().getModel("session").getProperty("/authenticated")) {
        this.getOwnerComponent().getRouter().navTo(
          this._getHomeRoute(
            this.getOwnerComponent().getModel("session").getProperty("/role")
          )
        );
      }
    },

    onSendOTP: function () {
      var oLoginModel = this.getView().getModel("login");
      var sEmail = oLoginModel.getProperty("/emailId");

      if (!sEmail) {
        MessageBox.error("Enter email ID.");
        return;
      }

      if (!sEmail.toLowerCase().endsWith("@sumodigitech.com")) {
        MessageBox.error("Only @sumodigitech.com email IDs are allowed.");
        return;
      }

      var sOtp = Math.floor(100000 + Math.random() * 900000).toString();

      oLoginModel.setProperty("/generatedOtp", sOtp);
      oLoginModel.setProperty("/otpSent", true);

      MessageBox.information(
        "OTP sent to " + sEmail + "\n\nDemo OTP: " + sOtp
      );
    },

    onLogin: async function () {
      var oLoginModel = this.getView().getModel("login");
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var oDataModel = this.getOwnerComponent().getModel();

      var sEmail = oLoginModel.getProperty("/emailId");
      var sEnteredOtp = oLoginModel.getProperty("/otp");
      var sGeneratedOtp = oLoginModel.getProperty("/generatedOtp");

      if (!sEmail) {
        MessageBox.error("Enter email ID.");
        return;
      }

      if (!sEnteredOtp) {
        MessageBox.error("Enter OTP.");
        return;
      }

      if (sEnteredOtp !== sGeneratedOtp) {
        MessageBox.error("Invalid OTP.");
        return;
      }

      try {
        var oBinding = oDataModel.bindList(
          "/Employees",
          null,
          null,
          null,
          {
            $filter: "emailId eq '" + sEmail + "'"
          }
        );

        var aContexts = await oBinding.requestContexts();

        if (!aContexts.length) {
          MessageBox.error("Employee not found.");
          return;
        }

        var oUser = aContexts[0].getObject();
        var sRole = oUser.role;

        var oSessionData = {
          authenticated: true,
          user: sEmail,
          fullName: oUser.name,
          role: sRole,
          employeeId: oUser.ID,
          teamMemberIds: [],
          appraisalCycle: "Jan 2026 - Dec 2026",
          isEmployee: sRole === "Employee",
          isManager: sRole === "Manager",
          isHRAdmin: sRole === "HR" || sRole === "Admin"
        };

        oSessionModel.setData(oSessionData);

        window.sessionStorage.setItem(
          "PRMS_SESSION",
          JSON.stringify(oSessionData)
        );

        this.getOwnerComponent().getRouter().navTo(
          this._getHomeRoute(sRole)
        );

      } catch (oError) {
        MessageBox.error("Unable to login.");
        console.error(oError);
      }
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



