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
        years: [],
        selectedYear: "",
        selectedHRSection: "createCycle",
        cycle: null,
        cycleText: "",

        cycleDraft: {
          year: new Date().getFullYear()
        },

        employees: [],
        managers: [],
        okrs: [],
        assessments: [],

        employeeDraft: {
          name: "",
          emailId: "",
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
      var sSelectedHRSection = oViewModel.getProperty("/selectedHRSection") || "createCycle";

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

        var aCycles = aResults[3];

        var aYears = [];
        aCycles.forEach(function (oCycleRow) {
          if (aYears.indexOf(String(oCycleRow.year)) === -1) {
            aYears.push(String(oCycleRow.year));
          }
        });
        aYears.sort();

        var sSelectedYear =
          oViewModel.getProperty("/selectedYear") ||
          String((this.getCurrentCycle(aCycles) || {}).year || aYears[0] || "");

        var aSelectedYearCycles = aCycles.filter(function (oCycleRow) {
          return String(oCycleRow.year) === String(sSelectedYear);
        });

        var aSelectedCycleIds = aSelectedYearCycles.map(function (oCycleRow) {
          return oCycleRow.ID;
        });

        var oCycle = aSelectedYearCycles[0] || null;

        var aAssessments = aResults[2]
          .filter(function (oAssessment) {
            return aSelectedCycleIds.indexOf(oAssessment.cycle_ID) !== -1;
          })
          .map(function (oAssessment) {
            var oLatestCheckIn = this._getLatestCheckInForEmployee(
              aResults[4],
              oAssessment.employee_ID,
              aSelectedCycleIds
            );

            return Object.assign({}, oAssessment, {
              employeeName: mEmployees[oAssessment.employee_ID] || "Unknown",
              latestSelfAssessmentText: oLatestCheckIn ? oLatestCheckIn.notes : (oAssessment.comments || ""),
              latestSelfRatingLabel: this._formatSelfRating(oLatestCheckIn ? oLatestCheckIn.selfRating : oAssessment.selfRating),
              latestManagerFeedback: oAssessment.managerComments || (oLatestCheckIn ? oLatestCheckIn.comments : "")
            });
          }.bind(this));

        oViewModel.setData({
          busy: false,
          cycles: aCycles,
          years: aYears,
          selectedYear: sSelectedYear,
          selectedHRSection: sSelectedHRSection,
          cycle: oCycle,
          cycleText: sSelectedYear,

          cycleDraft: {
            year: new Date().getFullYear()
          },

          employees: aEmployees,

          managers: aEmployees.filter(function (oEmployee) {
            return oEmployee.role === "Manager";
          }),

     
okrs: aResults[1]
  .filter(function (oOKR) {
    return aSelectedCycleIds.indexOf(oOKR.cycle_ID) !== -1;
  })
  .map(function (oOKR) {
    var oCycleRow = aCycles.find(function (oItem) {
      return oItem.ID === oOKR.cycle_ID;
    });

    return Object.assign({}, oOKR, {
      cycleText: oCycleRow ? String(oCycleRow.year) : ""
    });
  }),



          assessments: aAssessments,

          employeeDraft: {
            name: "",
            emailId: "",
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

    onHRSectionSelect: function (oEvent) {
      var sSection = oEvent.getSource().data("section");
      this.getView().getModel("view").setProperty("/selectedHRSection", sSection);
    },

    onYearChange: async function (oEvent) {
      this.getView().getModel("view").setProperty(
        "/selectedYear",
        oEvent.getParameter("selectedItem").getKey()
      );

      await this._loadData();
    },

    onCreateCycle: async function () {
      var oViewModel = this.getView().getModel("view");
      var oDraft = oViewModel.getProperty("/cycleDraft");
      var aCycles = oViewModel.getProperty("/cycles") || [];

      if (!oDraft.year) {
        MessageBox.error("Enter year.");
        return;
      }

      var bExists = aCycles.some(function (oCycle) {
        return String(oCycle.year) === String(oDraft.year);
      });

      if (bExists) {
        MessageBox.error("Appraisal cycle " + oDraft.year + " already exists.");
        return;
      }

      try {
        await Promise.all(["Q1", "Q2", "Q3", "Q4"].map(function (sQuarter) {
          return this.createEntity("AppraisalCycles", {
            year: parseInt(oDraft.year, 10),
            quarter: sQuarter,
            status: "Open",
            goalsOpen: true,
            checkInOpen: true,
            isCurrent: sQuarter === "Q1"
          });
        }.bind(this)));

        this.showToast("Appraisal cycle created for all quarters.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
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

    _getLatestCheckInForEmployee: function (aCheckIns, sEmployeeId, aCycleIds) {
      return (aCheckIns || []).filter(function (oCheckIn) {
        return oCheckIn.employee_ID === sEmployeeId &&
          aCycleIds.indexOf(oCheckIn.cycle_ID) !== -1;
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

      if (!oDraft.emailId) {
        MessageBox.error("Enter the email ID.");
        return;
      }

      try {
        await this.createEntity("Employees", {
          name: oDraft.name,
          emailId: oDraft.emailId,
          role: oDraft.role,
          manager_ID: oDraft.role === "HR" ? null : (oDraft.manager_ID || null)
        });

        this.showToast("Employee created.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    },

    onCreateOKR: async function () {
      var oViewModel = this.getView().getModel("view");
      var oDraft = oViewModel.getProperty("/okrDraft");
      var aCycles = oViewModel.getProperty("/cycles") || [];
      var sSelectedYear = oViewModel.getProperty("/selectedYear");

      if (!oDraft.title) {
        MessageBox.error("Enter the OKR title.");
        return;
      }

      if (!sSelectedYear) {
        MessageBox.error("Select appraisal year first.");
        return;
      }

      var oFirstQuarterCycle = aCycles.find(function (oCycle) {
        return String(oCycle.year) === String(sSelectedYear) &&
          oCycle.quarter === "Q1";
      });

      if (!oFirstQuarterCycle) {
        MessageBox.error("Selected appraisal year was not found.");
        return;
      }

      try {
        await this.createEntity("OKRs", {
          title: oDraft.title,
          description: oDraft.description,
          cycle_ID: oFirstQuarterCycle.ID
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
      var oViewModel = this.getView().getModel("view");
      var aCycles = oViewModel.getProperty("/cycles") || [];
      var sSelectedYear = oViewModel.getProperty("/selectedYear");

      var aSelectedYearCycles = aCycles.filter(function (oCycle) {
        return String(oCycle.year) === String(sSelectedYear);
      });

      if (!aSelectedYearCycles.length) {
        MessageBox.error("No appraisal cycle found.");
        return;
      }

      var bShouldOpen = aSelectedYearCycles.some(function (oCycle) {
        return oCycle.status !== "Open";
      });

      try {
        await Promise.all(aSelectedYearCycles.map(function (oCycle) {
          return this.patchEntity("AppraisalCycles", oCycle.ID, {
            status: bShouldOpen ? "Open" : "Closed",
            goalsOpen: bShouldOpen,
            checkInOpen: bShouldOpen
          });
        }.bind(this)));

        this.showToast("Appraisal cycle updated.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    }
  });
});
