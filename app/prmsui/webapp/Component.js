sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  "use strict";

  return UIComponent.extend("prmsui.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      var oStoredSession = null;
      try {
        oStoredSession = JSON.parse(window.sessionStorage.getItem("PRMS_SESSION") || "null");
      } catch (e) {
        oStoredSession = null;
      }

      this.setModel(new JSONModel({
        authenticated: oStoredSession ? oStoredSession.authenticated : false,
        user: oStoredSession ? oStoredSession.user : "",
        fullName: oStoredSession ? oStoredSession.fullName : "",
        role: oStoredSession ? oStoredSession.role : "",
        employeeId: oStoredSession ? oStoredSession.employeeId : "",
        teamMemberIds: oStoredSession ? oStoredSession.teamMemberIds : [],
        appraisalCycle: oStoredSession ? oStoredSession.appraisalCycle : "Jan 2026 - Dec 2026",
        isEmployee: oStoredSession ? oStoredSession.isEmployee : false,
        isManager: oStoredSession ? oStoredSession.isManager : false,
        isHRAdmin: oStoredSession ? oStoredSession.isHRAdmin : false
      }), "session");

      this.setModel(new JSONModel({
        users: []
      }), "users");

      this.getModel("users").loadData("model/mockUsers.json");
      this.getRouter().initialize();
    }
  });
});
