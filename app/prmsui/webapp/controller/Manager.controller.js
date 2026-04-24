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
        selectedCycleId: "",
        cycle: null,
        cycleText: "",
        teamMembers: [],
        teamGoals: [],
        okrs: [],
        teamCheckIns: [],
        assessments: []
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
      var aTeamMemberIds = this.getSessionModel().getProperty("/teamMemberIds") || [];

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
        var aTeamMembers = aEmployees.filter(function (oEmployee) {
          return aTeamMemberIds.indexOf(oEmployee.ID) !== -1;
        });
        var mEmployees = {};
        aEmployees.forEach(function (oEmployee) {
          mEmployees[oEmployee.ID] = oEmployee.name;
        });

        var aTeamGoals = aResults[1]
          .filter(function (oGoal) {
            return aTeamMemberIds.indexOf(oGoal.employee_ID) !== -1;
          })
          .map(function (oGoal) {
            return Object.assign({}, oGoal, {
              employeeName: mEmployees[oGoal.employee_ID] || "Unknown"
            });
          });

        var aTeamCheckIns = aResults[3]
          .filter(function (oCheckIn) {
            return aTeamMemberIds.indexOf(oCheckIn.employee_ID) !== -1;
          })
          .map(function (oCheckIn) {
            var oGoal = aTeamGoals.find(function (oEntry) {
              return oEntry.ID === oCheckIn.goal_ID;
            });

            return Object.assign({}, oCheckIn, {
              employeeName: mEmployees[oCheckIn.employee_ID] || "Unknown",
              goalTitle: oGoal ? oGoal.title : "Unknown Goal"
            });
          });

        var aAssessments = aResults[4]
          .filter(function (oAssessment) {
            return aTeamMemberIds.indexOf(oAssessment.employee_ID) !== -1;
          })
          .map(function (oAssessment) {
            return Object.assign({}, oAssessment, {
              employeeName: mEmployees[oAssessment.employee_ID] || "Unknown"
            });
          });

        var aCycles = aResults[5];
        var sSelectedCycleId = oViewModel.getProperty("/selectedCycleId") || (this.getCurrentCycle(aCycles) || {}).ID || "";
        var oCycle = aCycles.find(function (oEntry) {
          return oEntry.ID === sSelectedCycleId;
        }) || this.getCurrentCycle(aCycles);

        aTeamGoals = aTeamGoals.filter(function (oGoal) {
          return oGoal.cycle_ID === (oCycle && oCycle.ID);
        });
        aTeamCheckIns = aTeamCheckIns.filter(function (oCheckIn) {
          return oCheckIn.cycle_ID === (oCycle && oCycle.ID);
        }).map(function (oCheckIn) {
          return Object.assign({}, oCheckIn, {
            selfRatingLabel: this._formatSelfRating(oCheckIn.selfRating)
          });
        }.bind(this));
        aAssessments = aAssessments.filter(function (oAssessment) {
          return oAssessment.cycle_ID === (oCycle && oCycle.ID);
        }).map(function (oAssessment) {
          var oLatestCheckIn = this._getLatestCheckInForEmployee(aTeamCheckIns, oAssessment.employee_ID);
          return Object.assign({}, oAssessment, {
            latestCheckInNotes: oLatestCheckIn ? oLatestCheckIn.notes : "",
            latestCheckInSelfRating: oLatestCheckIn ? oLatestCheckIn.selfRating : oAssessment.selfRating,
            latestCheckInSelfRatingLabel: oLatestCheckIn ? this._formatSelfRating(oLatestCheckIn.selfRating) : this._formatSelfRating(oAssessment.selfRating),
            latestManagerComment: oLatestCheckIn ? oLatestCheckIn.comments : oAssessment.managerComments
          });
        }.bind(this));

        oViewModel.setData({
          busy: false,
          cycles: aCycles,
          selectedCycleId: oCycle ? oCycle.ID : "",
          cycle: oCycle,
          cycleText: this.formatCycleText(oCycle),
          teamMembers: aTeamMembers,
          teamGoals: aTeamGoals,
          okrs: aResults[2],
          teamCheckIns: aTeamCheckIns,
          assessments: aAssessments
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

    _getLatestCheckInForEmployee: function (aCheckIns, sEmployeeId) {
      var aEmployeeCheckIns = (aCheckIns || []).filter(function (oCheckIn) {
        return oCheckIn.employee_ID === sEmployeeId;
      });

      aEmployeeCheckIns.sort(function (a, b) {
        return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
      });

      return aEmployeeCheckIns[0] || null;
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
        this.showToast("Check-in comment saved.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onManagerRatingChange: async function (oEvent) {
      var oAssessment = oEvent.getSource().getBindingContext("view").getObject();

      try {
        await this.patchEntity("Assessments", oAssessment.ID, {
          managerRating: Number(oAssessment.managerRating)
        });
        this.showToast("Manager rating updated.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onSaveAssessmentFeedback: async function (oEvent) {
      var oAssessment = oEvent.getSource().getBindingContext("view").getObject();

      try {
        await this.patchEntity("Assessments", oAssessment.ID, {
          managerComments: oAssessment.managerComments || ""
        });
        this.showToast("Manager feedback saved.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onFinalizeAssessment: async function (oEvent) {
      var oAssessment = oEvent.getSource().getBindingContext("view").getObject();
      var iSelfRating = Number(oAssessment.latestCheckInSelfRating || oAssessment.selfRating || 0);
      var iFinalRating = ((iSelfRating + Number(oAssessment.managerRating || 0)) / 2);

      if (!oAssessment.managerRating) {
        MessageBox.error("Add the manager rating before final submission.");
        return;
      }

      try {
        await this.patchEntity("Assessments", oAssessment.ID, {
          selfRating: iSelfRating,
          comments: oAssessment.latestCheckInNotes || oAssessment.comments || "",
          finalRating: Number(iFinalRating.toFixed(1)),
          finalStatus: "Finalized",
          managerComments: oAssessment.managerComments || oAssessment.latestManagerComment || ""
        });
        this.showToast("Final rating submitted.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    }
  });
});
