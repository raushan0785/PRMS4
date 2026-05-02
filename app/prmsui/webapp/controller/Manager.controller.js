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
  var sManagerId = this.getSessionModel().getProperty("/employeeId");

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

    var aEmployees   = aResults[0];
    var aGoalsAll    = aResults[1];
      var aCycles      = aResults[5];
    
var aOKRs = aResults[2].map(function (oOKR) {

  var oCycleRow = aCycles.find(function (oItem) {
    return oItem.ID === oOKR.cycle_ID;
  });

  return Object.assign({}, oOKR, {
    cycleText: oCycleRow ?
      (oCycleRow.year + " " + oCycleRow.quarter) :
      ""
  });

});


    var aCheckInsAll = aResults[3];
    var aAssessAll   = aResults[4];
  

    /* Manager team */
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

    /* Current cycle */
    var sSelectedCycleId =
      oViewModel.getProperty("/selectedCycleId") ||
      (this.getCurrentCycle(aCycles) || {}).ID || "";

    var oCycle = aCycles.find(function (oEntry) {
      return oEntry.ID === sSelectedCycleId;
    }) || this.getCurrentCycle(aCycles);

    /* Goals */
    var aTeamGoals = aGoalsAll
      .filter(function (oGoal) {
        return aTeamMemberIds.indexOf(oGoal.employee_ID) !== -1 &&
               oGoal.cycle_ID === (oCycle && oCycle.ID);
      })
      .map(function (oGoal) {
        return Object.assign({}, oGoal, {
          employeeName: mEmployees[oGoal.employee_ID] || "Unknown"
        });
      });

    /* Check-ins */
    var aTeamCheckIns = aCheckInsAll
      .filter(function (oCheckIn) {
        return aTeamMemberIds.indexOf(oCheckIn.employee_ID) !== -1 &&
               oCheckIn.cycle_ID === (oCycle && oCycle.ID);
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

aTeamMembers.forEach(function (oEmp) {

  var aEmpRows = aAssessAll.filter(function (oItem) {
    return oItem.employee_ID === oEmp.ID;
  });

  /* Open rows first */
  aEmpRows
    .filter(function (oItem) {
      return oItem.finalStatus !== "Finalized";
    })
    .forEach(function (oRow) {
      aAssessments.unshift(
        Object.assign({}, oRow, {
          employeeName: oEmp.name
        })
      );
    });

  /* Finalized history */
  aEmpRows
    .filter(function (oItem) {
      return oItem.finalStatus === "Finalized";
    })
    .forEach(function (oRow) {
      aAssessments.push(
        Object.assign({}, oRow, {
          employeeName: oEmp.name
        })
      );
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
      okrs: aOKRs,
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

  var oCheckIn =
    oEvent.getSource()
      .getBindingContext("view")
      .getObject();

  try {

    /* Save comment in CheckIn row */
    await this.patchEntity("CheckIns", oCheckIn.ID, {
      comments: oCheckIn.comments || "",
      employeeAcknowledged: false
    });

    /* Create fresh active assessment row */
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
    var oPayload = {
      employee_ID: oAssessment.employee_ID,
      cycle_ID: oAssessment.cycle_ID,
      assessmentType: "Quarterly",
      managerRating: Number(oAssessment.managerRating || 0),
      selfRating: Number(
        oAssessment.latestCheckInSelfRating ||
        oAssessment.selfRating || 0
      ),
      finalStatus: oAssessment.finalStatus || "Open"
    };

    if (oAssessment.ID) {
      await this.patchEntity(
        "Assessments",
        oAssessment.ID,
        oPayload
      );
    } else {
      await this.createEntity(
        "Assessments",
        oPayload
      );
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
      await this.patchEntity(
        "Assessments",
        oAssessment.ID,
        oPayload
      );
    } else {
      await this.createEntity(
        "Assessments",
        oPayload
      );
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
    MessageBox.error(
      "Add the manager rating before final submission."
    );
    return;
  }

  var iFinalRating =
    (iSelfRating + iManagerRating) / 2;

  try {

    var oPayload = {
      employee_ID: oAssessment.employee_ID,
      cycle_ID: oAssessment.cycle_ID,
      assessmentType: "Quarterly",
      selfRating: iSelfRating,
      managerRating: iManagerRating,
      comments:
        oAssessment.latestCheckInNotes ||
        oAssessment.comments || "",
      managerComments:
        oAssessment.managerComments ||
        oAssessment.latestManagerComment || "",
      finalRating: Number(
        iFinalRating.toFixed(1)
      ),
      finalStatus: "Finalized"
    };

    if (oAssessment.ID) {
      await this.patchEntity(
        "Assessments",
        oAssessment.ID,
        oPayload
      );
    } else {
      await this.createEntity(
        "Assessments",
        oPayload
      );
    }

   
this.showToast("Final rating submitted.");

oAssessment.finalStatus = "Finalized";

await this._loadData();



  } catch (oError) {
    this.showError(oError);
  }
},

  });
});



  
