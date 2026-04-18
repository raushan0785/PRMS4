sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("prmsui.controller.App", {
    onInit: function () {
      var oViewModel = new JSONModel({
        busy: false,
        stats: {
          totalGoals: 0,
          completedGoals: 0,
          averageRating: "0.0"
        },
        generationRole: "Employee",
        generationMessage: "",
        generatedGoals: []
      });

      this.getView().setModel(oViewModel, "view");
      this._refreshDashboard();
    },

    onGenerateGoals: async function () {
      var oViewModel = this.getView().getModel("view");
      var oModel = this.getView().getModel();
      var sRole = oViewModel.getProperty("/generationRole");
      var aGoalsBefore = await this._requestCollection(oModel, "/Goals");

      oViewModel.setProperty("/busy", true);

      try {
        var oAction = oModel.bindContext("/generateGoals(...)");
        oAction.setParameter("role", sRole);
        await oAction.execute();

        var oResult = await oAction.getBoundContext().requestObject();
        var sMessage = oResult && oResult.value ? oResult.value : "Goals generated successfully.";

        oViewModel.setProperty("/generationMessage", sMessage);
        await this._refreshDashboard(aGoalsBefore);
        MessageToast.show("Goals generated successfully");
      } catch (oError) {
        MessageBox.error(this._extractErrorMessage(oError));
      } finally {
        oViewModel.setProperty("/busy", false);
      }
    },

    formatProgressState: function (iProgress) {
      if (iProgress >= 100) {
        return "Success";
      }
      if (iProgress >= 60) {
        return "Information";
      }
      if (iProgress >= 30) {
        return "Warning";
      }
      return "Error";
    },

    _refreshDashboard: async function (aPreviousGoals) {
      var oModel = this.getView().getModel();
      var oViewModel = this.getView().getModel("view");

      oViewModel.setProperty("/busy", true);

      try {
        var aGoals = await this._requestCollection(oModel, "/Goals");
        var aAssessments = await this._requestCollection(oModel, "/Assessments");

        var iCompletedGoals = aGoals.filter(function (oGoal) {
          return (oGoal.status || "").toLowerCase() === "completed";
        }).length;

        var aRatings = aAssessments
          .map(function (oAssessment) {
            return oAssessment.managerRating || oAssessment.selfRating;
          })
          .filter(function (iRating) {
            return iRating !== undefined && iRating !== null;
          });

        var fAverageRating = aRatings.length
          ? aRatings.reduce(function (iSum, iRating) {
              return iSum + iRating;
            }, 0) / aRatings.length
          : 0;

        oViewModel.setProperty("/stats", {
          totalGoals: aGoals.length,
          completedGoals: iCompletedGoals,
          averageRating: fAverageRating.toFixed(1)
        });

        var aGeneratedGoals = aGoals;
        if (Array.isArray(aPreviousGoals) && aPreviousGoals.length) {
          var aExistingIds = aPreviousGoals.map(function (oGoal) {
            return oGoal.ID;
          });

          aGeneratedGoals = aGoals.filter(function (oGoal) {
            return aExistingIds.indexOf(oGoal.ID) === -1;
          });
        }

        oViewModel.setProperty("/generatedGoals", aGeneratedGoals);
      } catch (oError) {
        MessageBox.error(this._extractErrorMessage(oError));
      } finally {
        oViewModel.setProperty("/busy", false);
      }
    },

    _requestCollection: async function (oModel, sPath) {
      var oBinding = oModel.bindList(sPath);
      var aContexts = await oBinding.requestContexts(0, 100);

      return Promise.all(aContexts.map(function (oContext) {
        return oContext.requestObject();
      }));
    },

    _extractErrorMessage: function (oError) {
      return oError && oError.message ? oError.message : "Something went wrong.";
    }
  });
});
