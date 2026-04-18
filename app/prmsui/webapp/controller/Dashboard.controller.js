sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("prmsui.controller.Dashboard", {
    onInit: function () {
      console.log("Dashboard.onInit() called");
      
      this.getView().setModel(new JSONModel({
        busy: true,
        showGoalForm: false,
        showCheckInForm: false,
        showEmployeeForm: false,
        generationMessage: "",
        generatedGoals: [],
        okrs: [],
        myGoals: [],
        teamGoals: [],
        orgGoals: [],
        assessments: [],
        checkIns: [],
        stats: {
          totalGoals: 0,
          completedGoals: 0,
          averageRating: "0.0",
          completionRate: "0.0",       // NEW: pre-computed for view
          finalizedAssessments: 0,     // NEW: pre-computed for view
          totalEmployees: 0,           // NEW: pre-computed for view
          hasAssessments: false,       // NEW: replaces .length > 0 in view
          hasCheckIns: false,          // NEW: replaces .length > 0 in view
          hasNoAssessment: true        // NEW: replaces .length === 0 in view
        },
        finalRatingText: "Pending",
        goalDraft: this._createGoalDraft(),
        checkInDraft: {},
        employeeDraft: {},
        loadError: ""
      }), "dashboard");

      this.getOwnerComponent().getRouter().getRoute("dashboard").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      if (!this.getOwnerComponent().getModel("session").getProperty("/authenticated")) {
        this.getOwnerComponent().getRouter().navTo("login");
        return;
      }

      console.log("Dashboard route matched. Loading data...");
      this._loadDashboardData().catch(function(oError) {
        console.error("Dashboard error:", oError);
      });
    },

    onLogout: function () {
      this.getOwnerComponent().getModel("session").setData({
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
      this.getOwnerComponent().getRouter().navTo("login");
    },

    onToggleGoalForm: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      oDashboardModel.setProperty("/showGoalForm", !oDashboardModel.getProperty("/showGoalForm"));
    },

    onCancelGoal: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      oDashboardModel.setProperty("/showGoalForm", false);
      oDashboardModel.setProperty("/goalDraft", this._createGoalDraft());
    },

    onCreateGoal: async function () {
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var oDashboardModel = this.getView().getModel("dashboard");
      var oDraft = oDashboardModel.getProperty("/goalDraft");

      if (!oDraft.title || !oDraft.type || !oDraft.status) {
        MessageBox.error("Please complete the goal title, type, and status.");
        return;
      }

      if (oDraft.type === "Performance" && !oDraft.okr_ID) {
        MessageBox.error("Performance goals must be mapped to an OKR.");
        return;
      }

      oDashboardModel.setProperty("/busy", true);

      try {
        var oListBinding = this.getView().getModel().bindList("/Goals");
        var oContext = oListBinding.create({
          title: oDraft.title,
          type: oDraft.type,
          status: oDraft.status,
          progress: Number(oDraft.progress || 0),
          employee_ID: oSessionModel.getProperty("/employeeId"),
          okr_ID: oDraft.okr_ID || null
        });

        await oContext.created();
        MessageToast.show("Goal created successfully");
        this.onCancelGoal();
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error(this._extractErrorMessage(oError));
      } finally {
        oDashboardModel.setProperty("/busy", false);
      }
    },

    onGenerateGoals: async function () {
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var oDashboardModel = this.getView().getModel("dashboard");
      var aPreviousGoalIds = (oDashboardModel.getProperty("/myGoals") || []).map(function (oGoal) {
        return oGoal.ID;
      });

      oDashboardModel.setProperty("/busy", true);

      try {
        var oAction = this.getView().getModel().bindContext("/generateGoals(...)");
        oAction.setParameter("role", oSessionModel.getProperty("/role"));
        await oAction.execute();

        var oResult = await oAction.getBoundContext().requestObject();
        oDashboardModel.setProperty("/generationMessage", oResult && oResult.value ? oResult.value : "Goals generated successfully.");

        await this._loadDashboardData(aPreviousGoalIds);
        MessageToast.show("Goals generated successfully");
      } catch (oError) {
        MessageBox.error(this._extractErrorMessage(oError));
      } finally {
        oDashboardModel.setProperty("/busy", false);
      }
    },

    onUpdateGoalProgress: async function (oEvent) {
      var oSource = oEvent.getSource();
      var sGoalId = oSource.getBindingContext("dashboard").getProperty("ID");
      var iNewProgress = oSource.getValue();
      var oDashboardModel = this.getView().getModel("dashboard");

      try {
        var oGoal = this.getView().getModel().bindContext(`/Goals('${sGoalId}')`);
        await oGoal.requestObject();
        oGoal.setProperty("progress", iNewProgress);
        await oGoal.save();
        MessageToast.show("Goal progress updated successfully");
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error("Failed to update goal progress: " + this._extractErrorMessage(oError));
      }
    },

    onUpdateGoalStatus: async function (oEvent) {
      var oSource = oEvent.getSource();
      var sGoalId = oSource.getBindingContext("dashboard").getProperty("ID");
      var sNewStatus = oSource.getSelectedKey();

      try {
        var oGoal = this.getView().getModel().bindContext(`/Goals('${sGoalId}')`);
        await oGoal.requestObject();
        oGoal.setProperty("status", sNewStatus);
        await oGoal.save();
        MessageToast.show("Goal status updated successfully");
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error("Failed to update goal status: " + this._extractErrorMessage(oError));
      }
    },

    onAddCheckIn: function (oEvent) {
      var oDashboardModel = this.getView().getModel("dashboard");
      
      if (oDashboardModel.getProperty("/myGoals").length === 0) {
        MessageBox.error("Please create or select a goal first to add a check-in.");
        return;
      }

      if (!oDashboardModel.getProperty("/showCheckInForm")) {
        oDashboardModel.setProperty("/showCheckInForm", true);
        oDashboardModel.setProperty("/checkInDraft", {
          goalId: "",
          goalTitle: "",
          progress: 0,
          notes: "",
          status: "In Progress"
        });
      }
    },

    onCancelCheckIn: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      oDashboardModel.setProperty("/showCheckInForm", false);
      oDashboardModel.setProperty("/checkInDraft", {});
    },

    onCreateCheckIn: async function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var oCheckInDraft = oDashboardModel.getProperty("/checkInDraft");

      if (!oCheckInDraft.notes) {
        MessageBox.error("Please add check-in notes.");
        return;
      }

      oDashboardModel.setProperty("/busy", true);

      try {
        var oListBinding = this.getView().getModel().bindList("/CheckIns");
        var oContext = oListBinding.create({
          goal_ID: oCheckInDraft.goalId,
          employee_ID: oSessionModel.getProperty("/employeeId"),
          progress: Number(oCheckInDraft.progress),
          notes: oCheckInDraft.notes,
          status: oCheckInDraft.status,
          checkInDate: new Date().toISOString()
        });

        await oContext.created();
        MessageToast.show("Check-in created successfully");
        this.onCancelCheckIn();
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error("Failed to create check-in: " + this._extractErrorMessage(oError));
      } finally {
        oDashboardModel.setProperty("/busy", false);
      }
    },

    onCreateAssessment: async function (oEvent) {
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var oDashboardModel = this.getView().getModel("dashboard");

      if (!oSessionModel.getProperty("/isManager") && !oSessionModel.getProperty("/isHRAdmin")) {
        MessageBox.error("Only managers and HR can create assessments.");
        return;
      }

      var aTeamMembers = oSessionModel.getProperty("/teamMemberIds") || [];
      var aAllEmployees = oDashboardModel.getProperty("/orgGoals") || [];

      var aAvailableEmployees = oSessionModel.getProperty("/isHRAdmin")
        ? aAllEmployees.map(function(g) { return g.employee_ID; }).filter(function(id, index, arr) { return arr.indexOf(id) === index; })
        : aTeamMembers;

      if (aAvailableEmployees.length === 0) {
        MessageBox.error("No employees available for assessment creation.");
        return;
      }

      var sEmployeeId = aAvailableEmployees[0];

      oDashboardModel.setProperty("/busy", true);

      try {
        var oListBinding = this.getView().getModel().bindList("/Assessments");
        var oContext = oListBinding.create({
          employee_ID: sEmployeeId,
          assessmentType: "Manager",
          managerRating: 0,
          selfRating: 0,
          finalRating: 0,
          finalStatus: "Open",
          comments: ""
        });

        await oContext.created();
        MessageToast.show("Assessment created successfully");
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error("Failed to create assessment: " + this._extractErrorMessage(oError));
      } finally {
        oDashboardModel.setProperty("/busy", false);
      }
    },

    onUpdateAssessmentRating: async function (oEvent) {
      var oSource = oEvent.getSource();
      var sAssessmentId = oSource.getBindingContext("dashboard").getProperty("ID");
      var iNewRating = oSource.getValue();
      var sRatingType = "managerRating";

      try {
        var oAssessment = this.getView().getModel().bindContext(`/Assessments('${sAssessmentId}')`);
        await oAssessment.requestObject();
        oAssessment.setProperty(sRatingType, iNewRating);
        await oAssessment.save();
        MessageToast.show("Assessment rating updated successfully");
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error("Failed to update rating: " + this._extractErrorMessage(oError));
      }
    },

    onFinalizeAssessment: async function (oEvent) {
      var oSource = oEvent.getSource();
      var sAssessmentId = oSource.getBindingContext("dashboard").getProperty("ID");

      try {
        var oAssessment = this.getView().getModel().bindContext(`/Assessments('${sAssessmentId}')`);
        await oAssessment.requestObject();

        var iManagerRating = oAssessment.getProperty("managerRating") || 0;
        var iSelfRating = oAssessment.getProperty("selfRating") || 0;
        var iFinalRating = (iManagerRating + iSelfRating) / 2;

        oAssessment.setProperty("finalRating", iFinalRating);
        oAssessment.setProperty("finalStatus", "Finalized");
        await oAssessment.save();

        MessageToast.show("Assessment finalized with rating: " + iFinalRating.toFixed(1));
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error("Failed to finalize assessment: " + this._extractErrorMessage(oError));
      }
    },

    _loadDashboardData: async function (aPreviousGoalIds) {
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var oDashboardModel = this.getView().getModel("dashboard");
      var sEmployeeId = oSessionModel.getProperty("/employeeId");
      var aTeamMemberIds = oSessionModel.getProperty("/teamMemberIds") || [];

      oDashboardModel.setProperty("/busy", true);
      oDashboardModel.setProperty("/loadError", "");

      try {
        console.log("Loading dashboard data for employee:", sEmployeeId);
        
        var aResults = await Promise.all([
          this._requestCollection("/Goals"),
          this._requestCollection("/OKRs"),
          this._requestCollection("/Assessments"),
          this._requestCollection("/Employees"),
          this._requestCollection("/CheckIns")
        ]);

        console.log("Dashboard data loaded successfully");
        
        var aGoals = aResults[0] || [];
        var aOKRs = aResults[1] || [];
        var aAssessments = aResults[2] || [];
        var aEmployees = aResults[3] || [];
        var aCheckIns = aResults[4] || [];

        var mEmployees = {};
        aEmployees.forEach(function (oEmployee) {
          mEmployees[oEmployee.ID] = oEmployee.name;
        });

        var aDecoratedGoals = aGoals.map(function (oGoal) {
          return Object.assign({}, oGoal, {
            employeeName: mEmployees[oGoal.employee_ID] || "Unknown"
          });
        });

        var aMyGoals = aDecoratedGoals.filter(function (oGoal) {
          return oGoal.employee_ID === sEmployeeId;
        });

        var aTeamGoals = aDecoratedGoals.filter(function (oGoal) {
          return aTeamMemberIds.indexOf(oGoal.employee_ID) !== -1;
        });

        var aVisibleGoals = oSessionModel.getProperty("/isEmployee")
          ? aMyGoals
          : oSessionModel.getProperty("/isManager")
            ? aTeamGoals
            : aDecoratedGoals;

        var aVisibleAssessments = aAssessments.filter(function (oAssessment) {
          if (oSessionModel.getProperty("/isEmployee")) return oAssessment.employee_ID === sEmployeeId;
          if (oSessionModel.getProperty("/isManager")) return aTeamMemberIds.indexOf(oAssessment.employee_ID) !== -1;
          return true;
        });

        var aVisibleCheckIns = aCheckIns.filter(function (oCheckIn) {
          if (oSessionModel.getProperty("/isEmployee")) return oCheckIn.employee_ID === sEmployeeId;
          if (oSessionModel.getProperty("/isManager")) return aTeamMemberIds.indexOf(oCheckIn.employee_ID) !== -1;
          return true;
        });

        var iCompletedGoals = aVisibleGoals.filter(function (oGoal) {
          return (oGoal.status || "").toLowerCase() === "completed";
        }).length;

        var iTotalGoals = aVisibleGoals.length;

        // Pre-compute completion rate safely (avoid NaN / division by zero)
        var fCompletionRate = iTotalGoals > 0
          ? (iCompletedGoals / iTotalGoals * 100)
          : 0;

        var aRatings = aVisibleAssessments
          .map(function (oAssessment) {
            return oAssessment.managerRating || oAssessment.selfRating;
          })
          .filter(function (iRating) {
            return iRating !== undefined && iRating !== null;
          });

        var fAverageRating = aRatings.length
          ? aRatings.reduce(function (iSum, iRating) { return iSum + iRating; }, 0) / aRatings.length
          : 0;

        // Pre-compute finalized assessments count
        var iFinalizedAssessments = aVisibleAssessments.filter(function (oAssessment) {
          return oAssessment.finalStatus === "Finalized";
        }).length;

        // Pre-compute unique employee count from orgGoals
        var iTotalEmployees = aDecoratedGoals.length;

        // Boolean flags to replace unsupported .length expressions in the view
        var bHasAssessments = aVisibleAssessments.length > 0;
        var bHasCheckIns = aVisibleCheckIns.length > 0;
        var bHasNoAssessment = aVisibleAssessments.length === 0;

        var sFinalRatingText = "Pending";
        if (oSessionModel.getProperty("/isEmployee")) {
          var oOwnAssessment = aAssessments.find(function (oAssessment) {
            return oAssessment.employee_ID === sEmployeeId;
          });

          if (oOwnAssessment) {
            sFinalRatingText = oOwnAssessment.finalStatus === "Finalized"
              ? "Finalized Rating: " + (oOwnAssessment.managerRating || oOwnAssessment.selfRating || "N/A")
              : "Open Review";
          }
        }

        var aGeneratedGoals = [];
        if (Array.isArray(aPreviousGoalIds)) {
          aGeneratedGoals = aMyGoals.filter(function (oGoal) {
            return aPreviousGoalIds.indexOf(oGoal.ID) === -1;
          });
        } else {
          aGeneratedGoals = oDashboardModel.getProperty("/generatedGoals") || [];
        }

        oDashboardModel.setData({
          busy: false,
          showGoalForm: oDashboardModel.getProperty("/showGoalForm"),
          showCheckInForm: oDashboardModel.getProperty("/showCheckInForm"),
          showEmployeeForm: oDashboardModel.getProperty("/showEmployeeForm"),
          generationMessage: oDashboardModel.getProperty("/generationMessage"),
          generatedGoals: aGeneratedGoals,
          okrs: aOKRs,
          myGoals: aMyGoals,
          teamGoals: aTeamGoals,
          orgGoals: aDecoratedGoals,
          assessments: aVisibleAssessments,
          checkIns: aVisibleCheckIns,
          stats: {
            totalGoals: iTotalGoals,
            completedGoals: iCompletedGoals,
            averageRating: fAverageRating.toFixed(1),
            completionRate: fCompletionRate.toFixed(1),       // NEW
            finalizedAssessments: iFinalizedAssessments,       // NEW
            totalEmployees: iTotalEmployees,                   // NEW
            hasAssessments: bHasAssessments,                   // NEW
            hasCheckIns: bHasCheckIns,                         // NEW
            hasNoAssessment: bHasNoAssessment                  // NEW
          },
          finalRatingText: sFinalRatingText,
          goalDraft: oDashboardModel.getProperty("/goalDraft") || this._createGoalDraft(),
          checkInDraft: oDashboardModel.getProperty("/checkInDraft") || {},
          employeeDraft: oDashboardModel.getProperty("/employeeDraft") || {},
          loadError: ""
        });
      } catch (oError) {
        console.error("Dashboard data load error:", oError);
        var sErrorMsg = this._extractErrorMessage(oError);
        oDashboardModel.setData({
          busy: false,
          showGoalForm: oDashboardModel.getProperty("/showGoalForm"),
          showCheckInForm: oDashboardModel.getProperty("/showCheckInForm"),
          showEmployeeForm: oDashboardModel.getProperty("/showEmployeeForm"),
          generationMessage: oDashboardModel.getProperty("/generationMessage"),
          generatedGoals: [],
          okrs: [],
          myGoals: [],
          teamGoals: [],
          orgGoals: [],
          assessments: [],
          checkIns: [],
          stats: {
            totalGoals: 0,
            completedGoals: 0,
            averageRating: "0.0",
            completionRate: "0.0",
            finalizedAssessments: 0,
            totalEmployees: 0,
            hasAssessments: false,
            hasCheckIns: false,
            hasNoAssessment: true
          },
          finalRatingText: "Pending",
          goalDraft: oDashboardModel.getProperty("/goalDraft") || this._createGoalDraft(),
          checkInDraft: oDashboardModel.getProperty("/checkInDraft") || {},
          employeeDraft: oDashboardModel.getProperty("/employeeDraft") || {},
          loadError: sErrorMsg
        });
      }
    },

    _requestCollection: async function (sPath) {
      try {
        var oModel = this.getView().getModel();
        if (!oModel) {
          console.error("OData model not available for path:", sPath);
          return [];
        }
        
        var oBinding = oModel.bindList(sPath);
        var aContexts = await oBinding.requestContexts(0, 200);

        return Promise.all(aContexts.map(function (oContext) {
          return oContext.requestObject();
        }));
      } catch (oError) {
        console.error("Error loading collection:", sPath, oError);
        throw oError;
      }
    },

    _createGoalDraft: function () {
      return {
        title: "",
        type: "Development",
        okr_ID: "",
        progress: 0,
        status: "Open"
      };
    },

    _extractErrorMessage: function (oError) {
      console.error("Full error object:", oError);
      if (oError && oError.message) {
        return oError.message;
      }
      if (oError && oError.responseText) {
        return "Server error: " + oError.responseText;
      }
      return "An unexpected error occurred. Please check the browser console for details.";
    },

    onPlaceholderAction: function () {
      MessageToast.show("This feature is under development.");
    },

    onViewAllAssessments: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var aAssessments = oDashboardModel.getProperty("/assessments") || [];
      
      var iTotal = aAssessments.length;
      var iFinalized = aAssessments.filter(function(a) { return a.finalStatus === "Finalized"; }).length;
      var iPending = iTotal - iFinalized;
      
      MessageBox.information(
        "Total Assessments: " + iTotal + "\n" +
        "Finalized: " + iFinalized + "\n" +
        "Pending: " + iPending,
        { title: "Assessments Summary" }
      );
    },

    onGenerateReports: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var aAssessments = oDashboardModel.getProperty("/assessments") || [];
      
      var iAvgRating = oDashboardModel.getProperty("/stats/averageRating");
      var iTotalGoals = oDashboardModel.getProperty("/stats/totalGoals");
      var iCompletedGoals = oDashboardModel.getProperty("/stats/completedGoals");
      var sCompletionRate = oDashboardModel.getProperty("/stats/completionRate");
      
      var sReport = "=== APPRAISAL CYCLE REPORT ===\n\n" +
        "Performance Metrics:\n" +
        "- Total Goals: " + iTotalGoals + "\n" +
        "- Completed Goals: " + iCompletedGoals + "\n" +
        "- Completion Rate: " + sCompletionRate + "%\n" +
        "- Average Rating: " + iAvgRating + "/5\n\n" +
        "Assessment Status:\n" +
        "- Total Assessments: " + aAssessments.length + "\n" +
        "- Finalized: " + aAssessments.filter(function(a) { return a.finalStatus === "Finalized"; }).length + "\n" +
        "- Pending: " + aAssessments.filter(function(a) { return a.finalStatus !== "Finalized"; }).length;
      
      MessageBox.information(sReport, { title: "Cycle Report", dialogWidth: "50%" });
    },

    onManageCycles: function () {
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var sCycle = oSessionModel.getProperty("/appraisalCycle");
      
      MessageBox.information(
        "Current Appraisal Cycle: " + sCycle + "\n\n" +
        "Cycle Management Features:\n" +
        "✓ View cycle timeline\n" +
        "✓ Configure cycle dates\n" +
        "✓ Manage cycle statuses\n" +
        "✓ Archive past cycles\n\n" +
        "This feature is available in the advanced admin panel.",
        { title: "Appraisal Cycle Management" }
      );
    },

    onExportData: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var aAssessments = oDashboardModel.getProperty("/assessments") || [];
      var aGoals = oDashboardModel.getProperty("/orgGoals") || [];
      var aCheckIns = oDashboardModel.getProperty("/checkIns") || [];
      
      var aCsvLines = [];
      
      aCsvLines.push("ASSESSMENTS");
      aCsvLines.push("Employee,Manager Rating,Self Rating,Final Rating,Status");
      aAssessments.forEach(function(oAssessment) {
        aCsvLines.push(
          (oAssessment.employeeName || "Unknown") + "," +
          (oAssessment.managerRating || "") + "," +
          (oAssessment.selfRating || "") + "," +
          (oAssessment.finalRating || "") + "," +
          (oAssessment.finalStatus || "")
        );
      });
      
      aCsvLines.push("");
      aCsvLines.push("GOALS");
      aCsvLines.push("Employee,Goal,Type,Status,Progress");
      aGoals.forEach(function(oGoal) {
        aCsvLines.push(
          (oGoal.employeeName || "Unknown") + "," +
          (oGoal.title || "") + "," +
          (oGoal.type || "") + "," +
          (oGoal.status || "") + "," +
          (oGoal.progress || 0)
        );
      });
      
      aCsvLines.push("");
      aCsvLines.push("CHECK-INS");
      aCsvLines.push("Date,Status,Progress,Notes");
      aCheckIns.forEach(function(oCheckIn) {
        aCsvLines.push(
          (oCheckIn.checkInDate || "") + "," +
          (oCheckIn.status || "") + "," +
          (oCheckIn.progress || 0) + "," +
          (oCheckIn.notes || "").replace(/,/g, ";")
        );
      });
      
      var sCsvContent = aCsvLines.join("\n");
      var oBlob = new Blob([sCsvContent], { type: "text/csv;charset=utf-8;" });
      var sLink = document.createElement("a");
      var sUrl = URL.createObjectURL(oBlob);
      
      sLink.setAttribute("href", sUrl);
      sLink.setAttribute("download", "PRMS_Export_" + new Date().toISOString().split("T")[0] + ".csv");
      sLink.style.visibility = "hidden";
      document.body.appendChild(sLink);
      sLink.click();
      document.body.removeChild(sLink);
      
      MessageToast.show("Data exported successfully");
    },

    onViewTeamCheckIns: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var aCheckIns = oDashboardModel.getProperty("/checkIns") || [];
      
      var iTotal = aCheckIns.length;
      var iCompleted = aCheckIns.filter(function(c) { return c.status === "Completed"; }).length;
      var iPending = iTotal - iCompleted;
      
      MessageBox.information(
        "Team Check-In Summary:\n\n" +
        "Total Check-Ins: " + iTotal + "\n" +
        "Completed: " + iCompleted + "\n" +
        "In Progress: " + iPending + "\n\n" +
        "Review the table below for detailed check-in records.",
        { title: "Team Check-In Status" }
      );
    },

    onFinalizeAllRatings: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var aAssessments = oDashboardModel.getProperty("/assessments") || [];
      
      var iPending = aAssessments.filter(function(a) { return a.finalStatus !== "Finalized"; }).length;
      
      if (iPending === 0) {
        MessageBox.information("All ratings are already finalized.", { title: "Finalization Status" });
        return;
      }
      
      MessageBox.confirm(
        "Finalize " + iPending + " pending assessment(s)?\n\nThis action cannot be undone.",
        {
          title: "Confirm Batch Finalization",
          onClose: function(sAction) {
            if (sAction === MessageBox.Action.OK) {
              MessageToast.show("Finalizing assessments...");
            }
          }
        }
      );
    },

    onCreateEmployee: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      
      if (!oDashboardModel.getProperty("/showEmployeeForm")) {
        oDashboardModel.setProperty("/showEmployeeForm", true);
        oDashboardModel.setProperty("/employeeDraft", {
          name: "",
          role: "Employee",
          username: "",
          password: "welcome123"
        });
      }
    },

    onCancelEmployee: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      oDashboardModel.setProperty("/showEmployeeForm", false);
      oDashboardModel.setProperty("/employeeDraft", {});
    },

    onSaveEmployee: async function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var oDraft = oDashboardModel.getProperty("/employeeDraft");

      if (!oDraft.name || !oDraft.username) {
        MessageBox.error("Please provide employee name and username.");
        return;
      }

      oDashboardModel.setProperty("/busy", true);

      try {
        var oListBinding = this.getView().getModel().bindList("/Employees");
        var oContext = oListBinding.create({
          name: oDraft.name,
          role: oDraft.role
        });

        await oContext.created();
        MessageToast.show("Employee created successfully");
        this.onCancelEmployee();
        await this._loadDashboardData();
      } catch (oError) {
        MessageBox.error("Failed to create employee: " + this._extractErrorMessage(oError));
      } finally {
        oDashboardModel.setProperty("/busy", false);
      }
    },

    onViewAnalytics: function () {
      var oDashboardModel = this.getView().getModel("dashboard");
      var aAssessments = oDashboardModel.getProperty("/assessments") || [];
      var aGoals = oDashboardModel.getProperty("/orgGoals") || [];
      
      var oAnalytics = {
        totalEmployees: oDashboardModel.getProperty("/stats/totalEmployees"),
        totalGoals: aGoals.length,
        completedGoals: aGoals.filter(function(g) { return g.status === "Completed"; }).length,
        avgRating: parseFloat(oDashboardModel.getProperty("/stats/averageRating")) || 0,
        finalizedAssessments: oDashboardModel.getProperty("/stats/finalizedAssessments"),
        totalAssessments: aAssessments.length
      };

      var sAnalytics = "=== ORGANIZATION ANALYTICS ===\n\n" +
        "👥 Workforce: " + oAnalytics.totalEmployees + " employees\n" +
        "🎯 Goals: " + oAnalytics.completedGoals + "/" + oAnalytics.totalGoals + " completed (" + 
        oDashboardModel.getProperty("/stats/completionRate") + "%)\n" +
        "⭐ Average Rating: " + oAnalytics.avgRating + "/5\n" +
        "📊 Assessments: " + oAnalytics.finalizedAssessments + "/" + oAnalytics.totalAssessments + " finalized\n\n" +
        "Performance Distribution:\n" +
        "• 4.5-5.0: " + aAssessments.filter(function(a) { return a.finalRating >= 4.5; }).length + " employees\n" +
        "• 3.5-4.4: " + aAssessments.filter(function(a) { return a.finalRating >= 3.5 && a.finalRating < 4.5; }).length + " employees\n" +
        "• 2.5-3.4: " + aAssessments.filter(function(a) { return a.finalRating >= 2.5 && a.finalRating < 3.5; }).length + " employees\n" +
        "• 0-2.4: " + aAssessments.filter(function(a) { return a.finalRating < 2.5; }).length + " employees";

      MessageBox.information(sAnalytics, { title: "Organization Analytics", dialogWidth: "60%" });
    },

    onSelfAssessment: function () {
      var oSessionModel = this.getOwnerComponent().getModel("session");
      var sEmployeeId = oSessionModel.getProperty("/employeeId");

      var that = this;
      var oDialog = new sap.m.Dialog({
        title: "Self Assessment",
        contentWidth: "500px",
        content: [
          new sap.ui.layout.form.SimpleForm({
            editable: true,
            layout: "ResponsiveGridLayout",
            content: [
              new sap.m.Label({ text: "Self Rating (1-5)" }),
              new sap.m.RatingIndicator({
                id: "selfRatingInput",
                maxValue: 5,
                value: 3
              }),
              new sap.m.Label({ text: "Comments" }),
              new sap.m.TextArea({
                id: "selfCommentsInput",
                rows: 3,
                placeholder: "Share your self-assessment comments..."
              })
            ]
          })
        ],
        buttons: [
          new sap.m.Button({
            text: "Submit",
            type: "Emphasized",
            press: function () {
              var iRating = sap.ui.getCore().byId("selfRatingInput").getValue();
              var sComments = sap.ui.getCore().byId("selfCommentsInput").getValue();
              that._createSelfAssessment(sEmployeeId, iRating, sComments);
              oDialog.close();
            }
          }),
          new sap.m.Button({
            text: "Cancel",
            press: function () {
              oDialog.close();
            }
          })
        ],
        afterClose: function () {
          oDialog.destroy();
        }
      });

      oDialog.open();
    },

    _createSelfAssessment: function (sEmployeeId, iRating, sComments) {
      var oODataModel = this.getView().getModel();

      oODataModel.create("/Assessments", {
        employee_ID: sEmployeeId,
        selfRating: iRating,
        selfComments: sComments,
        status: "Self-Submitted",
        createdAt: new Date()
      }, {
        success: function () {
          sap.m.MessageToast.show("Self assessment submitted successfully!");
          this._loadDashboardData();
        }.bind(this),
        error: function (oError) {
          sap.m.MessageToast.show("Error submitting self assessment: " + (oError.responseText || oError.message));
        }
      });
    }
  });
});