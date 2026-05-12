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
        years: [],
        selectedYear: "",
        selectedEmployeeSection: "okrs",
        cycleText: "",
        cycle: null,
        okrs: [],
        goals: [],
        checkInGoals: [],
        checkIns: [],
        assessments: [],
        managerName: "",
        goalDraft: this._getEmptyGoalDraft(),
        checkInDraft: this._getEmptyCheckInDraft(),
        yearEndDraft: this._getEmptyYearEndDraft(),
        editingCheckInId: "",
        stats: {
          canEditGoals: true,
          canEditCheckIns: true,
          canSubmitYearEnd: false,
          canResubmitYearEnd: false,
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
      var sSelectedEmployeeSection = oViewModel.getProperty("/selectedEmployeeSection") || "okrs";

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

        var aCycles = aResults[2];

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
        var bYearEndOpen = aSelectedYearCycles.some(function (oCycleRow) {
          return !!oCycleRow.yearEndOpen;
        });

        var aAllGoals = aResults[0].filter(function (oGoal) {
          return oGoal.employee_ID === sEmployeeId;
        });

        var aOKRs = aResults[1]
          .filter(function (oOKR) {
            return aSelectedCycleIds.indexOf(oOKR.cycle_ID) !== -1;
          })
          .map(function (oOKR) {
            var oOKRCycle = aCycles.find(function (oItem) {
              return oItem.ID === oOKR.cycle_ID;
            });

            return Object.assign({}, oOKR, {
              cycleText: oOKRCycle ? (oOKRCycle.year) : ""
            });
          });

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

        var aGoals = aAllGoals
          .filter(function (oGoal) {
            return aSelectedCycleIds.indexOf(oGoal.cycle_ID) !== -1;
          })
          .map(function (oGoal) {
            var oGoalCycle = aCycles.find(function (oCycleRow) {
              return oCycleRow.ID === oGoal.cycle_ID;
            });

            return Object.assign({}, oGoal, {
              quarter: oGoalCycle ? oGoalCycle.quarter : ""
            });
          });

        var aCheckInGoals = aGoals.filter(function (oGoal) {
          return !oGoal.checkInClosed;
        });

        var aCheckIns = aAllCheckIns.filter(function (oCheckIn) {
          return aSelectedCycleIds.indexOf(oCheckIn.cycle_ID) !== -1;
        });

        var aYearEndAssessments = aAllAssessments
          .filter(function (oAssessment) {
            return oAssessment.assessmentType === "Year-End" &&
              aSelectedCycleIds.indexOf(oAssessment.cycle_ID) !== -1;
          })
          .map(function (oAssessment) {
            var oGoal = aGoals.find(function (oGoalRow) {
              return oGoalRow.ID === oAssessment.goal_ID;
            });

            return Object.assign({}, oAssessment, {
              goalTitle: oGoal ? oGoal.title : "Year-End Goal",
              statusText: oAssessment.finalStatus || "Open",
              latestSelfAssessmentText: "",
              latestSelfRatingLabel: this._formatSelfRating(oAssessment.selfRating),
              latestManagerFeedback: oAssessment.managerComments || "",
              managerRatingText: oAssessment.managerRating ? (oAssessment.managerRating + "/5") : "Pending",
              managerCommentText: oAssessment.managerComments || "Pending"
            });
          }.bind(this));

        var oAssessment = this._getDefaultYearEndAssessment(aGoals, aYearEndAssessments);

        var aDecoratedCheckIns = aCheckIns.map(function (oCheckIn) {
          return Object.assign({}, oCheckIn, {
            selfRatingLabel: this._formatSelfRating(oCheckIn.selfRating)
          });
        }.bind(this));

        oViewModel.setData({
          busy: false,
          cycles: aCycles,
          years: aYears,
          selectedYear: sSelectedYear,
          selectedEmployeeSection: sSelectedEmployeeSection,
          cycle: oCycle,
          cycleText: sSelectedYear,
          okrs: aOKRs,
          goals: aGoals,
          checkInGoals: aCheckInGoals,
          checkIns: aDecoratedCheckIns,
          assessments: aYearEndAssessments,
          managerName: oManager ? oManager.name : "Not assigned",
          goalDraft: this._getEmptyGoalDraft(),
          checkInDraft: this._getEmptyCheckInDraft(aCheckInGoals),
          yearEndDraft: this._getEmptyYearEndDraft(aGoals, oAssessment),
          editingCheckInId: "",
          stats: {
            canEditGoals: aSelectedYearCycles.some(function (oCycleRow) {
              return !!oCycleRow.goalsOpen;
            }),
            canEditCheckIns: aSelectedYearCycles.some(function (oCycleRow) {
              return !!oCycleRow.checkInOpen;
            }),
            canSubmitYearEnd: bYearEndOpen,
            canResubmitYearEnd: bYearEndOpen && aYearEndAssessments.some(function (oItem) {
              return oItem.finalStatus === "ManagerRated" && (oItem.sendBackCount || 0) < 1;
            }),
            canSendBack: false,
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
        startDate: "",
        endDate: "",
        quarter: "Q1",
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

    _getEmptyYearEndDraft: function (aGoals, oAssessment) {
      var oGoal = aGoals && aGoals.length ? aGoals[0] : null;

      return {
        goal_ID: (oAssessment && oAssessment.goal_ID) || (oGoal && oGoal.ID) || "",
        status: (oAssessment && oAssessment.finalStatus) || "Open",
        selfRating: (oAssessment && oAssessment.selfRating) || 3,
        managerRating: (oAssessment && oAssessment.managerRating) || 0,
        managerComments: (oAssessment && oAssessment.managerComments) || ""
      };
    },

    _getDefaultYearEndAssessment: function (aGoals, aAssessments) {
      var aGoalIds = (aGoals || []).map(function (oGoal) {
        return oGoal.ID;
      });

      return (aAssessments || []).find(function (oAssessment) {
        return oAssessment.finalStatus !== "Finalized";
      }) || (aAssessments || []).find(function (oAssessment) {
        return aGoalIds.indexOf(oAssessment.goal_ID) !== -1;
      }) || null;
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

    onEmployeeSectionSelect: function (oEvent) {
      var sSection = oEvent.getSource().data("section");
      this.getView().getModel("view").setProperty("/selectedEmployeeSection", sSection);
    },

    onYearChange: async function (oEvent) {
      this.getView().getModel("view").setProperty(
        "/selectedYear",
        oEvent.getParameter("selectedItem").getKey()
      );

      await this._loadData();
    },

    onYearEndGoalChange: function (oEvent) {
      var sGoalId = oEvent.getParameter("selectedItem").getKey();
      var oViewModel = this.getView().getModel("view");
      var oAssessment = (oViewModel.getProperty("/assessments") || []).find(function (oItem) {
        return oItem.goal_ID === sGoalId;
      });

      oViewModel.setProperty("/yearEndDraft", this._getEmptyYearEndDraft(
        oViewModel.getProperty("/goals") || [],
        oAssessment || { goal_ID: sGoalId }
      ));
    },

    onCreateGoal: async function () {
      var oViewModel = this.getView().getModel("view");
      var oDraft = oViewModel.getProperty("/goalDraft");
      var aCycles = oViewModel.getProperty("/cycles") || [];
      var sSelectedYear = oViewModel.getProperty("/selectedYear");

      if (!oDraft.title || !oDraft.type) {
        MessageBox.error("Enter the goal title and type.");
        return;
      }

      if (oDraft.type === "Performance" && !oDraft.okr_ID) {
        MessageBox.error("Performance goals must be mapped to a company OKR.");
        return;
      }

      if (!oDraft.startDate || !oDraft.endDate) {
        MessageBox.error("Select start date and end date.");
        return;
      }

      if (new Date(oDraft.startDate).getTime() > new Date(oDraft.endDate).getTime()) {
        MessageBox.error("Start date cannot be after end date.");
        return;
      }

      var oGoalCycle = aCycles.find(function (oCycleRow) {
        return String(oCycleRow.year) === String(sSelectedYear) &&
          oCycleRow.quarter === oDraft.quarter;
      });

      if (!oGoalCycle) {
        MessageBox.error("Selected quarter cycle was not found.");
        return;
      }

      oViewModel.setProperty("/busy", true);

      try {
        await this.createEntity("Goals", {
          title: oDraft.title,
          description: oDraft.description,
          type: oDraft.type,
          status: oDraft.status,
          progress: 0,
          startDate: oDraft.startDate,
          endDate: oDraft.endDate,
          checkInClosed: false,
          employee_ID: this.getSessionModel().getProperty("/employeeId"),
          okr_ID: oDraft.okr_ID || null,
          submissionStatus: "Draft",
          cycle_ID: oGoalCycle.ID
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
      var aGoals = oViewModel.getProperty("/goals") || [];
      var aCycles = oViewModel.getProperty("/cycles") || [];

      if (!oDraft.goal_ID || !oDraft.notes) {
        MessageBox.error("Select a goal and add a short update.");
        return;
      }

      var oSelectedGoal = aGoals.find(function (oGoal) {
        return oGoal.ID === oDraft.goal_ID;
      });

      if (oSelectedGoal && oSelectedGoal.checkInClosed) {
        MessageBox.error("Quarterly check-in is closed for this goal.");
        return;
      }

      var oGoalCycle = aCycles.find(function (oCycleRow) {
        return oSelectedGoal && oCycleRow.ID === oSelectedGoal.cycle_ID;
      });

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
            quarter: (oGoalCycle && oGoalCycle.quarter) || "Q1",
            status: oDraft.status,
            comments: "",
            notes: oDraft.notes,
            focusArea: oDraft.focusArea,
            selfRating: Number(oDraft.selfRating),
            progress: Number(oDraft.progress || 0),
            checkInDate: new Date().toISOString(),
            cycle_ID: oSelectedGoal ? oSelectedGoal.cycle_ID : null
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
    },

    onSubmitYearEndAssessment: async function () {
      var oViewModel = this.getView().getModel("view");
      var oDraft = oViewModel.getProperty("/yearEndDraft");
      var aGoals = oViewModel.getProperty("/goals") || [];
      var aCycles = oViewModel.getProperty("/cycles") || [];
      var aAssessments = oViewModel.getProperty("/assessments") || [];
      var sSelectedYear = oViewModel.getProperty("/selectedYear");
      var oExistingAssessment = aAssessments.find(function (oAssessment) {
        return oAssessment.goal_ID === oDraft.goal_ID;
      }) || null;

      if (!oDraft.goal_ID) {
        MessageBox.error("Select a goal for the year-end assessment.");
        return;
      }

      var oSelectedGoal = aGoals.find(function (oGoal) {
        return oGoal.ID === oDraft.goal_ID;
      });

      var oCycle = aCycles.find(function (oCycleRow) {
        return String(oCycleRow.year) === String(sSelectedYear) && !!oCycleRow.yearEndOpen;
      });

      if (!oCycle) {
        MessageBox.error("Year-End Assessment is not open for the selected year.");
        return;
      }

      if (oExistingAssessment && oExistingAssessment.finalStatus === "Finalized") {
        MessageBox.error("This goal's year-end assessment is already finalized.");
        return;
      }

      if (oExistingAssessment && (oExistingAssessment.finalStatus === "Submitted" || oExistingAssessment.finalStatus === "Resubmitted")) {
        MessageBox.error("This goal's year-end assessment is already with your manager.");
        return;
      }

      if (oExistingAssessment && oExistingAssessment.finalStatus === "ManagerRated" && (oExistingAssessment.sendBackCount || 0) >= 1) {
        MessageBox.error("This goal's one resubmission chance has already been used.");
        return;
      }

      try {
        var oPayload = {
          employee_ID: this.getSessionModel().getProperty("/employeeId"),
          cycle_ID: oCycle.ID,
          goal_ID: oDraft.goal_ID,
          assessmentType: "Year-End",
          selfRating: Number(oDraft.selfRating || 0),
          managerRating: Number(oExistingAssessment && oExistingAssessment.managerRating || 0),
          managerComments: oExistingAssessment ? (oExistingAssessment.managerComments || "") : "",
          comments: oSelectedGoal ? (oSelectedGoal.title + " | " + oSelectedGoal.status) : "",
          finalRating: Number(oExistingAssessment && oExistingAssessment.finalRating || 0),
          finalStatus: oExistingAssessment && oExistingAssessment.finalStatus === "ManagerRated" ? "Resubmitted" : "Submitted",
          sendBackCount: oExistingAssessment && oExistingAssessment.finalStatus === "ManagerRated" ? 1 : 0
        };

        if (oExistingAssessment) {
          await this.patchEntity("Assessments", oExistingAssessment.ID, oPayload);
          this.showToast("Year-End Assessment resubmitted to your manager.");
        } else {
          await this.createEntity("Assessments", oPayload);
          this.showToast("Year-End Assessment submitted to your manager.");
        }

        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    }
  });
});  