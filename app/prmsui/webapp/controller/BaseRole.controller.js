sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("prmsui.controller.BaseRole", {
    createViewModel: function (oInitialData) {
      return new JSONModel(oInitialData || {});
    },

    getSessionModel: function () {
      return this.getOwnerComponent().getModel("session");
    },

    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },

    getHomeRouteForRole: function (sRole) {
      if (sRole === "Manager") {
        return "manager";
      }

      if (sRole === "HR" || sRole === "Admin") {
        return "hr";
      }

      return "employee";
    },

    onLogout: function () {
      this.getSessionModel().setData({
        authenticated: false,
        user: "",
        fullName: "",
        role: "",
        employeeId: "",
        teamMemberIds: [],
        appraisalCycle: "Jan 2026 - Dec 2026",
        isEmployee: false,
        isManager: false,
        isHRAdmin: false
      });
      window.sessionStorage.removeItem("PRMS_SESSION");
      this.getRouter().navTo("login");
    },

    requestCollection: async function (sPath) {
      var oBinding = this.getView().getModel().bindList(sPath);
      var aContexts = await oBinding.requestContexts(0, 500);

      return Promise.all(aContexts.map(function (oContext) {
        return oContext.requestObject();
      }));
    },

    createEntity: async function (sEntitySet, oPayload) {
      var oListBinding = this.getView().getModel().bindList("/" + sEntitySet);
      var oContext = oListBinding.create(oPayload);
      await oContext.created();
      return oContext.requestObject();
    },

    executeAction: async function (sActionName, oParameters) {
      var oAction = this.getView().getModel().bindContext("/" + sActionName + "(...)");

      Object.keys(oParameters || {}).forEach(function (sKey) {
        oAction.setParameter(sKey, oParameters[sKey]);
      });

      await oAction.execute();
      return oAction.getBoundContext().requestObject();
    },

    buildServiceUrl: function (sRelativePath) {
      var sBasePath = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService/uri") || "/odata/v4/prms/";
      return sBasePath.replace(/\/$/, "") + sRelativePath;
    },

    patchEntity: async function (sEntitySet, sEntityId, oPayload) {
      var oResponse = await fetch(this.buildServiceUrl("/" + sEntitySet + "('" + encodeURIComponent(sEntityId) + "')"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(oPayload)
      });

      if (!oResponse.ok) {
        throw new Error(await this._extractResponseError(oResponse));
      }
    },

    _extractResponseError: async function (oResponse) {
      var sText = await oResponse.text();

      try {
        var oPayload = JSON.parse(sText);
        return oPayload.error && oPayload.error.message ? oPayload.error.message : sText;
      } catch (oError) {
        return sText || ("Request failed with status " + oResponse.status);
      }
    },

    getCurrentCycle: function (aCycles) {
      return (aCycles || []).find(function (oCycle) {
        return oCycle.isCurrent;
      }) || null;
    },

    formatCycleText: function (oCycle) {
      if (!oCycle) {
        return "No active appraisal cycle";
      }

      return oCycle.year + " - " + oCycle.quarter;
    },

    extractErrorMessage: function (oError) {
      return oError && oError.message ? oError.message : "Something went wrong.";
    },

    showError: function (oError) {
      MessageBox.error(this.extractErrorMessage(oError));
    },

    showToast: function (sMessage) {
      MessageToast.show(sMessage);
    }
  });
});
