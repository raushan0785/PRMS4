sap.ui.define([
  "prmsui/controller/BaseRole.controller",
  "sap/m/MessageBox"
], function (BaseRoleController, MessageBox) {
  "use strict";

  return BaseRoleController.extend("prmsui.controller.Employee", {
    onInit: function () {
      this.getView().setModel(this.createViewModel({
        busy: false,
        cycles: [],
        selectedCycleId: "",
        cycleText: "",
        cycle: null,
        okrs: [],
        goals: [],
        checkIns: [],
        assessments: [],
        managerName: "",
        goalDraft: this._getEmptyGoalDraft(),
        checkInDraft: this._getEmptyCheckInDraft(),
        editingCheckInId: "",
        stats: {
          canEditGoals: true,
          canEditCheckIns: true,
          canSendBack: false,
          hasAssessment: false,
          hasFinalizedAssessment: false
        }
      }), "view");

      this.getRouter().getRoute("employee").attachPatternMatched(this._onRouteMatched, this);
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
      var sEmployeeId = this.getSessionModel().getProperty("/employeeId");

      oViewModel.setProperty("/busy", true);

      try {
        var aResults = await Promise.all([
          this.requestCollection("/Goals"),
          this.requestCollection("/OKRs"),
          this.requestCollection("/AppraisalCycles"),
          this.requestCollection("/Assessments"),
          this.requestCollection("/CheckIns"),
          this.requestCollection("/Employees")
        ]);

        var aAllGoals = aResults[0].filter(function (oGoal) {
          return oGoal.employee_ID === sEmployeeId;
        });
        
        var aCycles = aResults[2];
        
var aOKRs = aResults[1].map(function (oOKR) {

  var oCycle = aCycles.find(function (oItem) {
    return oItem.ID === oOKR.cycle_ID;
  });

  return Object.assign({}, oOKR, {
    cycleText: oCycle ? (oCycle.year + " / " + oCycle.quarter) : ""
  });

});


        // var aAllAssessments = aResults[3].filter(function (oAssessment) {
        //   return oAssessment.employee_ID === sEmployeeId;
        // });
        // var aAllCheckIns = aResults[4].filter(function (oCheckIn) {
        //   return oCheckIn.employee_ID === sEmployeeId;
        // });
        // var aEmployees = aResults[5];
        // var oEmployee = aEmployees.find(function (oEntry) {
        //   return oEntry.ID === sEmployeeId;
        // });
        // var oManager = aEmployees.find(function (oEntry) {
        //   return oEntry.ID === (oEmployee && oEmployee.manager_ID);
        // });
        // var sSelectedCycleId = oViewModel.getProperty("/selectedCycleId") || (this.getCurrentCycle(aCycles) || {}).ID || "";
        // var oCycle = aCycles.find(function (oEntry) {
        //   return oEntry.ID === sSelectedCycleId;
        // }) || this.getCurrentCycle(aCycles);
        // var aGoals = aAllGoals.filter(function (oGoal) {
        //   return oGoal.cycle_ID === (oCycle && oCycle.ID);
        // });
        // var aCheckIns = aAllCheckIns.filter(function (oCheckIn) {
        //   return oCheckIn.cycle_ID === (oCycle && oCycle.ID);
        // });
        // var aAssessments = aAllAssessments.filter(function (oAssessment) {
        //   return oAssessment.cycle_ID === (oCycle && oCycle.ID);
        // }).map(function (oAssessment) {
        //   var oLatestCheckIn = this._getLatestCheckIn(aCheckIns);
        //   return Object.assign({}, oAssessment, {
        //     latestSelfAssessmentText: oLatestCheckIn ? oLatestCheckIn.notes : (oAssessment.comments || ""),
        //     latestSelfRatingLabel: this._formatSelfRating(oLatestCheckIn ? oLatestCheckIn.selfRating : oAssessment.selfRating),
        //     latestManagerFeedback: oAssessment.managerComments || (oLatestCheckIn ? oLatestCheckIn.comments : "")
        //   });
        // }.bind(this));
        
var aAllAssessments = aResults[3].filter(function (oAssessment) {
  return oAssessment.employee_ID === sEmployeeId;
});

var aAllCheckIns = aResults[4].filter(function (oCheckIn) {
  return oCheckIn.employee_ID === sEmployeeId;
});

var aEmployees = aResults[5];

var oEmployee = aEmployees.find(function (oEntry) {
  return oEntry.ID === sEmployeeId;
});

var oManager = aEmployees.find(function (oEntry) {
  return oEntry.ID === (oEmployee && oEmployee.manager_ID);
});

var sSelectedCycleId =
  oViewModel.getProperty("/selectedCycleId") ||
  (this.getCurrentCycle(aCycles) || {}).ID || "";

var oCycle = aCycles.find(function (oEntry) {
  return oEntry.ID === sSelectedCycleId;
}) || this.getCurrentCycle(aCycles);

var aGoals = aAllGoals.filter(function (oGoal) {
  return oGoal.cycle_ID === (oCycle && oCycle.ID);
});

var aCheckIns = aAllCheckIns.filter(function (oCheckIn) {
  return oCheckIn.cycle_ID === (oCycle && oCycle.ID);
});


        
var aAssessments = aAllAssessments
  .filter(function (oAssessment) {
    return oAssessment.finalStatus === "Finalized";
  })
  .sort(function (a, b) {

    if (a.cycle_ID === (oCycle && oCycle.ID)) {
      return -1;
    }

    if (b.cycle_ID === (oCycle && oCycle.ID)) {
      return 1;
    }

    return 0;

  })
  .map(function (oAssessment) {

    return Object.assign({}, oAssessment, {

      latestSelfAssessmentText: "",

      latestSelfRatingLabel:
        this._formatSelfRating(
          oAssessment.selfRating
        ),

      latestManagerFeedback:
        oAssessment.managerComments || ""

    });

  }.bind(this));










        var oAssessment = aAssessments[0] || null;
        var aDecoratedCheckIns = aCheckIns.map(function (oCheckIn) {
          return Object.assign({}, oCheckIn, {
            selfRatingLabel: this._formatSelfRating(oCheckIn.selfRating)
          });
        }.bind(this));






        oViewModel.setData({
          busy: false,
          cycles: aCycles,
          selectedCycleId: oCycle ? oCycle.ID : "",
          cycle: oCycle,
          cycleText: this.formatCycleText(oCycle),
          okrs: aOKRs,
          goals: aGoals,
          checkIns: aDecoratedCheckIns,
          assessments: aAssessments,
          managerName: oManager ? oManager.name : "Not assigned",
          goalDraft: this._getEmptyGoalDraft(),
          checkInDraft: this._getEmptyCheckInDraft(aGoals),
          editingCheckInId: "",
          stats: {
            canEditGoals: !!(oCycle && oCycle.goalsOpen),
            canEditCheckIns: !!(oCycle && oCycle.checkInOpen),
            canSendBack: !!(oAssessment && oAssessment.finalStatus === "Finalized" && (oAssessment.sendBackCount || 0) < 1),
            hasAssessment: !!oAssessment,
            hasFinalizedAssessment: !!(oAssessment && oAssessment.finalStatus === "Finalized")
          }
        });
      } catch (oError) {
        oViewModel.setProperty("/busy", false);
        this.showError(oError);
      }
    },

    _getEmptyGoalDraft: function () {
      return {
        title: "",
        description: "",
        type: "Development",
        status: "Open",
        progress: 0,
        okr_ID: ""
      };
    },

    _getEmptyCheckInDraft: function (aGoals) {
      return {
        goal_ID: aGoals && aGoals.length ? aGoals[0].ID : "",
        progress: 0,
        status: "In Progress",
        notes: "",
        focusArea: "Delivery",
        selfRating: 3
      };
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

    _getLatestCheckIn: function (aCheckIns) {
      return (aCheckIns || []).slice().sort(function (a, b) {
        return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
      })[0] || null;
    },

    onCycleChange: async function (oEvent) {
      this.getView().getModel("view").setProperty("/selectedCycleId", oEvent.getParameter("selectedItem").getKey());
      await this._loadData();
    },

    onCreateGoal: async function () {
      var oViewModel = this.getView().getModel("view");
      var oDraft = oViewModel.getProperty("/goalDraft");

      if (!oDraft.title || !oDraft.type) {
        MessageBox.error("Enter the goal title and type.");
        return;
      }

      if (oDraft.type === "Performance" && !oDraft.okr_ID) {
        MessageBox.error("Performance goals must be mapped to a company OKR.");
        return;
      }

      oViewModel.setProperty("/busy", true);

      try {
        await this.createEntity("Goals", {
          title: oDraft.title,
          description: oDraft.description,
          type: oDraft.type,
          status: oDraft.status,
          progress: Number(oDraft.progress || 0),
          employee_ID: this.getSessionModel().getProperty("/employeeId"),
          okr_ID: oDraft.okr_ID || null,
          submissionStatus: "Draft",
          cycle_ID: oViewModel.getProperty("/selectedCycleId")
        });

        this.showToast("Goal created.");
        await this._loadData();
      } catch (oError) {
        oViewModel.setProperty("/busy", false);
        this.showError(oError);
      }
    },

    onSubmitGoalsForApproval: async function () {
      var oViewModel = this.getView().getModel("view");

      oViewModel.setProperty("/busy", true);

      try {
        var oResult = await this.executeAction("submitGoalsForApproval", {
          employeeID: this.getSessionModel().getProperty("/employeeId")
        });

        this.showToast(oResult && oResult.value ? oResult.value : "Goals submitted for manager approval.");
        await this._loadData();
      } catch (oError) {
        oViewModel.setProperty("/busy", false);
        this.showError(oError);
      }
    },

    onUpdateGoalProgress: async function (oEvent) {
      var oGoal = oEvent.getSource().getBindingContext("view").getObject();

      try {
        await this.patchEntity("Goals", oGoal.ID, {
          progress: Number(oGoal.progress),
          status: oGoal.status
        });
        this.showToast("Goal progress updated.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    },

    onAddCheckIn: async function () {
      var oViewModel = this.getView().getModel("view");
      var oDraft = oViewModel.getProperty("/checkInDraft");
      var sEditingCheckInId = oViewModel.getProperty("/editingCheckInId");

      if (!oDraft.goal_ID || !oDraft.notes) {
        MessageBox.error("Select a goal and add a short update.");
        return;
      }

      oViewModel.setProperty("/busy", true);

      try {
        if (sEditingCheckInId) {
          await this.patchEntity("CheckIns", sEditingCheckInId, {
            status: "Resubmitted",
            notes: oDraft.notes,
            focusArea: oDraft.focusArea,
            selfRating: Number(oDraft.selfRating),
            progress: Number(oDraft.progress || 0),
            checkInDate: new Date().toISOString(),
            employeeAcknowledged: false,
            resubmittedOnce: true
          });
          this.showToast("Quarterly update edited and sent again.");
        } else {
          await this.createEntity("CheckIns", {
            goal_ID: oDraft.goal_ID,
            employee_ID: this.getSessionModel().getProperty("/employeeId"),
            quarter: (oViewModel.getProperty("/cycle") || {}).quarter || "Q1",
            status: oDraft.status,
            comments: "",
            notes: oDraft.notes,
            focusArea: oDraft.focusArea,
            selfRating: Number(oDraft.selfRating),
            progress: Number(oDraft.progress || 0),
            checkInDate: new Date().toISOString(),
            cycle_ID: oViewModel.getProperty("/selectedCycleId")
          });
          this.showToast("Check-in submitted to your manager.");
        }

        await this._loadData();
      } catch (oError) {
        oViewModel.setProperty("/busy", false);
        this.showError(oError);
      }
    },

    onEditCheckIn: function (oEvent) {
      var oCheckIn = oEvent.getSource().getBindingContext("view").getObject();

      this.getView().getModel("view").setProperty("/editingCheckInId", oCheckIn.ID);
      this.getView().getModel("view").setProperty("/checkInDraft", {
        goal_ID: oCheckIn.goal_ID,
        progress: oCheckIn.progress,
        status: oCheckIn.status === "Completed" ? "Completed" : "In Progress",
        notes: oCheckIn.notes,
        focusArea: oCheckIn.focusArea || "Delivery",
        selfRating: oCheckIn.selfRating || 3
      });

      this.showToast("Quarterly update loaded for editing.");
    },

    onSendBackRating: async function () {
      var oViewModel = this.getView().getModel("view");
      var oAssessment = (oViewModel.getProperty("/assessments") || []).find(function (oEntry) {
        return oEntry.finalStatus === "Finalized";
      });

      if (!oAssessment) {
        MessageBox.error("No finalized rating is available to send back.");
        return;
      }

      oViewModel.setProperty("/busy", true);

      try {
        var oResult = await this.executeAction("sendBackAssessment", {
          assessmentID: oAssessment.ID
        });

        this.showToast(oResult && oResult.value ? oResult.value : "Final rating sent back for reconsideration.");
        await this._loadData();
      } catch (oError) {
        oViewModel.setProperty("/busy", false);
        this.showError(oError);
      }
    }
  });
});
