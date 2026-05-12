sap.ui.define([
  "prmsui/controller/BaseRole.controller",
  "sap/m/MessageBox"
], function (BaseRoleController, MessageBox) {
  "use strict";

  return BaseRoleController.extend("prmsui.controller.Manager", {
    onInit: function () {
      this.getView().setModel(this.createViewModel({
        busy: false,
        cycles: [],
        years: [],
        selectedYear: "",
        cycle: null,
        cycleText: "",
        teamMembers: [],
        teamGoals: [],
        okrs: [],
        teamCheckIns: [],
        assessments: [],

        selectedEmployeeId: "",
        selectedEmployeeName: "",
        selectedManagerSection: "okrs",
        selectedTeamGoals: [],
        selectedTeamCheckIns: [],
        selectedAssessments: []
      }), "view");

      this.getRouter().getRoute("manager").attachPatternMatched(this._onRouteMatched, this);
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
      var sManagerId = this.getSessionModel().getProperty("/employeeId");

      var sSelectedEmployeeId = oViewModel.getProperty("/selectedEmployeeId") || "";
      var sSelectedEmployeeName = oViewModel.getProperty("/selectedEmployeeName") || "";
      var sSelectedManagerSection = oViewModel.getProperty("/selectedManagerSection") || "okrs";

      oViewModel.setProperty("/busy", true);

      try {
        var aResults = await Promise.all([
          this.requestCollection("/Employees"),
          this.requestCollection("/Goals"),
          this.requestCollection("/OKRs"),
          this.requestCollection("/CheckIns"),
          this.requestCollection("/Assessments"),
          this.requestCollection("/AppraisalCycles")
        ]);

        var aEmployees = aResults[0];
        var aGoalsAll = aResults[1];
        var aCycles = aResults[5];

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

        var aOKRs = aResults[2]
          .filter(function (oOKR) {
            return aSelectedCycleIds.indexOf(oOKR.cycle_ID) !== -1;
          })
          .map(function (oOKR) {
            var oCycleRow = aCycles.find(function (oItem) {
              return oItem.ID === oOKR.cycle_ID;
            });

            return Object.assign({}, oOKR, {
              cycleText: oCycleRow ? (oCycleRow.year) : ""
            });
          });

        var aCheckInsAll = aResults[3];
        var aAssessAll = aResults[4];

        var aTeamMembers = aEmployees.filter(function (oEmployee) {
          return oEmployee.manager_ID === sManagerId;
        });

        var aTeamMemberIds = aTeamMembers.map(function (oEmployee) {
          return oEmployee.ID;
        });

        var mEmployees = {};
        aEmployees.forEach(function (oEmployee) {
          mEmployees[oEmployee.ID] = oEmployee.name;
        });

        var aTeamGoals = aGoalsAll
          .filter(function (oGoal) {
            return aTeamMemberIds.indexOf(oGoal.employee_ID) !== -1 &&
              aSelectedCycleIds.indexOf(oGoal.cycle_ID) !== -1;
          })
          .map(function (oGoal) {
            var oGoalCycle = aCycles.find(function (oCycleRow) {
              return oCycleRow.ID === oGoal.cycle_ID;
            });

            return Object.assign({}, oGoal, {
              employeeName: mEmployees[oGoal.employee_ID] || "Unknown",
              cycleText: oGoalCycle ? (oGoalCycle.year + " " + oGoalCycle.quarter) : "",
              quarter: oGoalCycle ? oGoalCycle.quarter : "",
              startDate: oGoal.startDate || "",
              endDate: oGoal.endDate || "",
              checkInClosed: !!oGoal.checkInClosed
            });
          });

        var aTeamCheckIns = aCheckInsAll
          .filter(function (oCheckIn) {
            return aTeamMemberIds.indexOf(oCheckIn.employee_ID) !== -1 &&
              aSelectedCycleIds.indexOf(oCheckIn.cycle_ID) !== -1;
          })
          .map(function (oCheckIn) {
            var oGoal = aTeamGoals.find(function (oEntry) {
              return oEntry.ID === oCheckIn.goal_ID;
            });

            return Object.assign({}, oCheckIn, {
              employeeName: mEmployees[oCheckIn.employee_ID] || "Unknown",
              goalTitle: oGoal ? oGoal.title : "Unknown Goal",
              selfRatingLabel: this._formatSelfRating(oCheckIn.selfRating)
            });
          }.bind(this));

        var aAssessments = [];
        var mGoals = {};
        aGoalsAll.forEach(function (oGoal) {
          mGoals[oGoal.ID] = oGoal.title;
        });

        aTeamMembers.forEach(function (oEmp) {
          var aEmpRows = aAssessAll.filter(function (oItem) {
            return oItem.employee_ID === oEmp.ID &&
              oItem.assessmentType === "Year-End" &&
              aSelectedCycleIds.indexOf(oItem.cycle_ID) !== -1;
          });

          aEmpRows
            .filter(function (oItem) {
              return oItem.finalStatus !== "Finalized";
            })
            .forEach(function (oRow) {
              aAssessments.unshift(
                Object.assign({}, oRow, {
                  employeeName: oEmp.name,
                  goalTitle: mGoals[oRow.goal_ID] || "Year-End Goal",
                  latestSelfRatingLabel: this._formatSelfRating(oRow.selfRating),
                  managerRatingText: oRow.managerRating ? (oRow.managerRating + "/5") : "Pending",
                  managerCommentText: oRow.managerComments || "Pending"
                })
              );
            }.bind(this));

          aEmpRows
            .filter(function (oItem) {
              return oItem.finalStatus === "Finalized";
            })
            .forEach(function (oRow) {
              aAssessments.push(
                Object.assign({}, oRow, {
                  employeeName: oEmp.name,
                  goalTitle: mGoals[oRow.goal_ID] || "Year-End Goal",
                  latestSelfRatingLabel: this._formatSelfRating(oRow.selfRating),
                  managerRatingText: oRow.managerRating ? (oRow.managerRating + "/5") : "Pending",
                  managerCommentText: oRow.managerComments || "Pending"
                })
              );
            }.bind(this));
        }.bind(this));

        var bSelectedEmployeeExists = aTeamMembers.some(function (oEmployee) {
          return oEmployee.ID === sSelectedEmployeeId;
        });

        if (!bSelectedEmployeeExists) {
          sSelectedEmployeeId = "";
          sSelectedEmployeeName = "";
        }

        oViewModel.setData({
          busy: false,
          cycles: aCycles,
          years: aYears,
          selectedYear: sSelectedYear,
          cycle: oCycle,
          cycleText: sSelectedYear,
          teamMembers: aTeamMembers,
          teamGoals: aTeamGoals,
          okrs: aOKRs,
          teamCheckIns: aTeamCheckIns,
          assessments: aAssessments,

          selectedEmployeeId: sSelectedEmployeeId,
          selectedEmployeeName: sSelectedEmployeeName,
          selectedManagerSection: sSelectedManagerSection,
          selectedTeamGoals: aTeamGoals.filter(function (oGoal) {
            return oGoal.employee_ID === sSelectedEmployeeId;
          }),
          selectedTeamCheckIns: aTeamCheckIns.filter(function (oCheckIn) {
            return oCheckIn.employee_ID === sSelectedEmployeeId;
          }),
          selectedAssessments: aAssessments.filter(function (oAssessment) {
            return oAssessment.employee_ID === sSelectedEmployeeId;
          })
        });

      } catch (oError) {
        oViewModel.setProperty("/busy", false);
        this.showError(oError);
      }
    },

    _updateSelectedEmployeeData: function () {
      var oViewModel = this.getView().getModel("view");
      var sEmployeeId = oViewModel.getProperty("/selectedEmployeeId");

      var aTeamGoals = oViewModel.getProperty("/teamGoals") || [];
      var aTeamCheckIns = oViewModel.getProperty("/teamCheckIns") || [];
      var aAssessments = oViewModel.getProperty("/assessments") || [];

      oViewModel.setProperty("/selectedTeamGoals", aTeamGoals.filter(function (oGoal) {
        return oGoal.employee_ID === sEmployeeId;
      }));

      oViewModel.setProperty("/selectedTeamCheckIns", aTeamCheckIns.filter(function (oCheckIn) {
        return oCheckIn.employee_ID === sEmployeeId;
      }));

      oViewModel.setProperty("/selectedAssessments", aAssessments.filter(function (oAssessment) {
        return oAssessment.employee_ID === sEmployeeId;
      }));
    },

    onTeamMemberPress: function (oEvent) {
      var oEmployee = oEvent.getSource().getBindingContext("view").getObject();

      this.getView().getModel("view").setProperty("/selectedEmployeeId", oEmployee.ID);
      this.getView().getModel("view").setProperty("/selectedEmployeeName", oEmployee.name);
      this.getView().getModel("view").setProperty("/selectedManagerSection", "okrs");

      this._updateSelectedEmployeeData();
    },

    onManagerSectionSelect: function (oEvent) {
      var sSection = oEvent.getSource().data("section");
      this.getView().getModel("view").setProperty("/selectedManagerSection", sSection);
    },

    onYearChange: async function (oEvent) {
      this.getView().getModel("view").setProperty(
        "/selectedYear",
        oEvent.getParameter("selectedItem").getKey()
      );

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

    _getLatestCheckInForEmployee: function (aCheckIns, sEmployeeId) {
      var aEmployeeCheckIns = (aCheckIns || []).filter(function (oCheckIn) {
        return oCheckIn.employee_ID === sEmployeeId;
      });

      aEmployeeCheckIns.sort(function (a, b) {
        return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
      });

      return aEmployeeCheckIns[0] || null;
    },

    onCloseGoalCheckIn: async function (oEvent) {
      var oGoal = oEvent.getSource().getBindingContext("view").getObject();

      try {
        await this.patchEntity("Goals", oGoal.ID, {
          checkInClosed: true
        });

        this.showToast("Quarter check-in closed for this goal.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    },

    onApproveGoal: async function (oEvent) {
      var oGoal = oEvent.getSource().getBindingContext("view").getObject();

      try {
        await this.patchEntity("Goals", oGoal.ID, {
          submissionStatus: "Approved",
          managerComment: oGoal.managerComment || "Approved by manager."
        });

        this.showToast("Goal approved.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onRejectGoal: async function (oEvent) {
      var oGoal = oEvent.getSource().getBindingContext("view").getObject();

      if (!oGoal.managerComment) {
        MessageBox.error("Add a short comment before rejecting a goal.");
        return;
      }

      try {
        await this.patchEntity("Goals", oGoal.ID, {
          submissionStatus: "Rejected",
          managerComment: oGoal.managerComment
        });

        this.showToast("Goal rejected.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onSaveCheckInComment: async function (oEvent) {
      var oCheckIn = oEvent.getSource().getBindingContext("view").getObject();

      try {
        await this.patchEntity("CheckIns", oCheckIn.ID, {
          comments: oCheckIn.comments || "",
          employeeAcknowledged: false
        });

        await this.createEntity("Assessments", {
          employee_ID: oCheckIn.employee_ID,
          cycle_ID: oCheckIn.cycle_ID,
          assessmentType: "Quarterly",
          selfRating: oCheckIn.selfRating || 0,
          managerRating: 0,
          managerComments: oCheckIn.comments || "",
          comments: oCheckIn.notes || "",
          finalRating: 0,
          finalStatus: "Open"
        });

        this.showToast("Comment saved.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    },

    onManagerRatingChange: async function (oEvent) {
      var oAssessment = oEvent.getSource().getBindingContext("view").getObject();

      try {
        var bYearEnd = oAssessment.assessmentType === "Year-End";
        var oPayload = {
          employee_ID: oAssessment.employee_ID,
          cycle_ID: oAssessment.cycle_ID,
          goal_ID: oAssessment.goal_ID || null,
          assessmentType: bYearEnd ? "Year-End" : "Quarterly",
          managerRating: Number(oAssessment.managerRating || 0),
          managerComments: oAssessment.managerComments || "",
          selfRating: Number(
            oAssessment.latestCheckInSelfRating ||
            oAssessment.selfRating || 0
          ),
          finalStatus: oAssessment.finalStatus || "Open"
        };

        if (oAssessment.ID) {
          await this.patchEntity("Assessments", oAssessment.ID, oPayload);
        } else {
          await this.createEntity("Assessments", oPayload);
        }

        this.showToast("Manager rating updated.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    },

    onSaveAssessmentFeedback: async function (oEvent) {
      var oAssessment = oEvent.getSource().getBindingContext("view").getObject();

      try {
        var oPayload = {
          employee_ID: oAssessment.employee_ID,
          cycle_ID: oAssessment.cycle_ID,
          assessmentType: "Quarterly",
          selfRating: Number(
            oAssessment.latestCheckInSelfRating ||
            oAssessment.selfRating || 0
          ),
          managerRating: Number(oAssessment.managerRating || 0),
          managerComments: oAssessment.managerComments || "",
          finalStatus: oAssessment.finalStatus || "Open"
        };

        if (oAssessment.ID) {
          await this.patchEntity("Assessments", oAssessment.ID, oPayload);
        } else {
          await this.createEntity("Assessments", oPayload);
        }

        this.showToast("Manager feedback saved.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    },

    onFinalizeAssessment: async function (oEvent) {
      var oAssessment = oEvent.getSource().getBindingContext("view").getObject();

      var iSelfRating = Number(
        oAssessment.latestCheckInSelfRating ||
        oAssessment.selfRating || 0
      );

      var iManagerRating = Number(
        oAssessment.managerRating || 0
      );

      if (!iManagerRating) {
        MessageBox.error("Add the manager rating before final submission.");
        return;
      }

      var iFinalRating = (iSelfRating + iManagerRating) / 2;
      var bYearEnd = oAssessment.assessmentType === "Year-End";
      var sNextStatus = bYearEnd && oAssessment.finalStatus === "Submitted"
        ? "ManagerRated"
        : "Finalized";

      try {
        var oPayload = {
          employee_ID: oAssessment.employee_ID,
          cycle_ID: oAssessment.cycle_ID,
          goal_ID: oAssessment.goal_ID || null,
          assessmentType: bYearEnd ? "Year-End" : "Quarterly",
          selfRating: iSelfRating,
          managerRating: iManagerRating,
          comments:
            oAssessment.latestCheckInNotes ||
            oAssessment.comments || "",
          managerComments:
            oAssessment.managerComments ||
            oAssessment.latestManagerComment || "",
          finalRating: Number(iFinalRating.toFixed(1)),
          finalStatus: sNextStatus
        };

        if (oAssessment.ID) {
          await this.patchEntity("Assessments", oAssessment.ID, oPayload);
        } else {
          await this.createEntity("Assessments", oPayload);
        }

        this.showToast(sNextStatus === "Finalized" ? "Final rating submitted." : "Manager rating submitted to employee.");
        oAssessment.finalStatus = sNextStatus;

        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    }
  });
});
