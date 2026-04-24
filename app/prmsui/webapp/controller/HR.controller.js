sap.ui.define([
  "prmsui/controller/BaseRole.controller",
  "sap/m/MessageBox"
], function (BaseRoleController, MessageBox) {
  "use strict";

  return BaseRoleController.extend("prmsui.controller.HR", {
    onInit: function () {
      this.getView().setModel(this.createViewModel({
        busy: false,
        cycles: [],
        selectedCycleId: "",
        cycle: null,
        cycleText: "",
        employees: [],
        managers: [],
        okrs: [],
        assessments: [],
        employeeDraft: {
          name: "",
          role: "Employee",
          manager_ID: ""
        },
        okrDraft: {
          title: "",
          description: ""
        }
      }), "view");

      this.getRouter().getRoute("hr").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: async function () {
      if (!this.getSessionModel().getProperty("/authenticated")) {
        this.getRouter().navTo("login");
        return;
      }

      await this._loadData();
    },

    _loadData: async function () {
      var oViewModel = this.getView().getModel("view");

      oViewModel.setProperty("/busy", true);

      try {
        var aResults = await Promise.all([
          this.requestCollection("/Employees"),
          this.requestCollection("/OKRs"),
          this.requestCollection("/Assessments"),
          this.requestCollection("/AppraisalCycles"),
          this.requestCollection("/CheckIns"),
          this.requestCollection("/Goals")
        ]);

        var aEmployees = aResults[0];
        var mEmployees = {};
        aEmployees.forEach(function (oEmployee) {
          mEmployees[oEmployee.ID] = oEmployee.name;
        });

        var aAssessments = aResults[2].map(function (oAssessment) {
          return Object.assign({}, oAssessment, {
            employeeName: mEmployees[oAssessment.employee_ID] || "Unknown"
          });
        });

        var aCycles = aResults[3];
        var sSelectedCycleId = oViewModel.getProperty("/selectedCycleId") || (this.getCurrentCycle(aCycles) || {}).ID || "";
        var oCycle = aCycles.find(function (oEntry) {
          return oEntry.ID === sSelectedCycleId;
        }) || this.getCurrentCycle(aCycles);
        aAssessments = aAssessments.filter(function (oAssessment) {
          return oAssessment.cycle_ID === (oCycle && oCycle.ID);
        }).map(function (oAssessment) {
          var oLatestCheckIn = this._getLatestCheckInForEmployee(aResults[4], oAssessment.employee_ID, oCycle && oCycle.ID);
          return Object.assign({}, oAssessment, {
            latestSelfAssessmentText: oLatestCheckIn ? oLatestCheckIn.notes : (oAssessment.comments || ""),
            latestSelfRatingLabel: this._formatSelfRating(oLatestCheckIn ? oLatestCheckIn.selfRating : oAssessment.selfRating),
            latestManagerFeedback: oAssessment.managerComments || (oLatestCheckIn ? oLatestCheckIn.comments : "")
          });
        }.bind(this));
        oViewModel.setData({
          busy: false,
          cycles: aCycles,
          selectedCycleId: oCycle ? oCycle.ID : "",
          cycle: oCycle,
          cycleText: this.formatCycleText(oCycle),
          employees: aEmployees,
          managers: aEmployees.filter(function (oEmployee) {
            return oEmployee.role === "Manager";
          }),
          okrs: aResults[1],
          assessments: aAssessments,
          employeeDraft: {
            name: "",
            role: "Employee",
            manager_ID: ""
          },
          okrDraft: {
            title: "",
            description: ""
          }
        });
      } catch (oError) {
        oViewModel.setProperty("/busy", false);
        this.showError(oError);
      }
    },

    onCycleChange: async function (oEvent) {
      this.getView().getModel("view").setProperty("/selectedCycleId", oEvent.getParameter("selectedItem").getKey());
      await this._loadData();
    },

    _formatSelfRating: function (iSelfRating) {
      var mRatings = {
        1: "Too New to Assess",
        2: "Needs Improvement",
        3: "Meets Expectations",
        4: "Exceeds Expectations",
        5: "Outstanding"
      };

      return mRatings[iSelfRating] || "Not Rated";
    },

    _getLatestCheckInForEmployee: function (aCheckIns, sEmployeeId, sCycleId) {
      return (aCheckIns || []).filter(function (oCheckIn) {
        return oCheckIn.employee_ID === sEmployeeId && oCheckIn.cycle_ID === sCycleId;
      }).sort(function (a, b) {
        return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
      })[0] || null;
    },

    onCreateEmployee: async function () {
      var oDraft = this.getView().getModel("view").getProperty("/employeeDraft");

      if (!oDraft.name) {
        MessageBox.error("Enter the employee name.");
        return;
      }

      try {
        await this.createEntity("Employees", {
          name: oDraft.name,
          role: oDraft.role,
          manager_ID: oDraft.manager_ID || null
        });
        this.showToast("Employee created.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onCreateOKR: async function () {
      var oDraft = this.getView().getModel("view").getProperty("/okrDraft");

      if (!oDraft.title) {
        MessageBox.error("Enter the OKR title.");
        return;
      }

      try {
        await this.createEntity("OKRs", {
          title: oDraft.title,
          description: oDraft.description
        });
        this.showToast("OKR created.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onSaveOKR: async function (oEvent) {
      var oOKR = oEvent.getSource().getBindingContext("view").getObject();

      try {
        await this.patchEntity("OKRs", oOKR.ID, {
          title: oOKR.title,
          description: oOKR.description
        });
        this.showToast("OKR updated.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onToggleCycleStatus: async function () {
      var oCycle = this.getView().getModel("view").getProperty("/cycle");

      if (!oCycle) {
        MessageBox.error("No appraisal cycle found.");
        return;
      }

      try {
        await this.patchEntity("AppraisalCycles", oCycle.ID, {
          status: oCycle.status === "Open" ? "Closed" : "Open",
          goalsOpen: oCycle.status !== "Open",
          checkInOpen: oCycle.status !== "Open"
        });
        this.showToast("Appraisal cycle updated.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onToggleCheckInWindow: async function () {
      var oCycle = this.getView().getModel("view").getProperty("/cycle");

      if (!oCycle) {
        MessageBox.error("No appraisal cycle found.");
        return;
      }

      try {
        await this.patchEntity("AppraisalCycles", oCycle.ID, {
          checkInOpen: !oCycle.checkInOpen
        });
        this.showToast("Check-in window updated.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    }
  });
});
