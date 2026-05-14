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
        selectedAssessments: [],
        overallFinalRating: 0,
        canFinalizeOverall: false
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

        var aSelectedAssessments = aAssessments.filter(function (oAssessment) {
          return oAssessment.employee_ID === sSelectedEmployeeId;
        });

        // Compute overall rating for the selected employee based on all
        // goal-level manager ratings for the currently "open" year-end assessments.
        var aOpenAssessmentsForEmployee = aSelectedAssessments.filter(function (oAssessment) {
          return oAssessment.finalStatus === "Submitted" ||
            oAssessment.finalStatus === "Resubmitted" ||
            oAssessment.finalStatus === "ManagerRated";
        });

        var bAllOpenGoalsRated = aOpenAssessmentsForEmployee.length > 0 &&
          !aOpenAssessmentsForEmployee.some(function (oAssessment) {
            return !Number(oAssessment.managerRating || 0);
          });

        var fOverallFinalRating = bAllOpenGoalsRated
          ? (aOpenAssessmentsForEmployee.reduce(function (sum, oAssessment) {
            return sum + Number(oAssessment.managerRating || 0);
          }, 0) / aOpenAssessmentsForEmployee.length)
          : 0;

        // If there is already a finalized overall rating stored, keep showing it.
        if (!fOverallFinalRating) {
          var oAnyFinalAssessment = aSelectedAssessments.find(function (oAssessment) {
            return !!oAssessment.finalRating;
          });
          fOverallFinalRating = oAnyFinalAssessment ? Number(oAnyFinalAssessment.finalRating || 0) : 0;
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
          selectedAssessments: aSelectedAssessments,
          overallFinalRating: Number((fOverallFinalRating || 0).toFixed(1)),
          canFinalizeOverall: bAllOpenGoalsRated && aOpenAssessmentsForEmployee.length > 0
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

      var aSelectedAssessments = oViewModel.getProperty("/selectedAssessments") || [];
      var aOpenAssessmentsForEmployee = aSelectedAssessments.filter(function (oAssessment) {
        return oAssessment.finalStatus === "Submitted" ||
          oAssessment.finalStatus === "Resubmitted" ||
          oAssessment.finalStatus === "ManagerRated";
      });

      var bAllOpenGoalsRated = aOpenAssessmentsForEmployee.length > 0 &&
        !aOpenAssessmentsForEmployee.some(function (oAssessment) {
          return !Number(oAssessment.managerRating || 0);
        });

      var fOverallFinalRating = bAllOpenGoalsRated
        ? (aOpenAssessmentsForEmployee.reduce(function (sum, oAssessment) {
          return sum + Number(oAssessment.managerRating || 0);
        }, 0) / aOpenAssessmentsForEmployee.length)
        : 0;

      if (!fOverallFinalRating) {
        var oAnyFinalAssessment = aSelectedAssessments.find(function (oAssessment) {
          return !!oAssessment.finalRating;
        });
        fOverallFinalRating = oAnyFinalAssessment ? Number(oAnyFinalAssessment.finalRating || 0) : 0;
      }

      oViewModel.setProperty("/overallFinalRating", Number((fOverallFinalRating || 0).toFixed(1)));
      oViewModel.setProperty("/canFinalizeOverall", bAllOpenGoalsRated && aOpenAssessmentsForEmployee.length > 0);
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

        if (oCheckIn.goal_ID) {
          await this.patchEntity("Goals", oCheckIn.goal_ID, {
            checkInClosed: true
          });
        }

        this.showToast("Comment saved.");
        await this._loadData();

      } catch (oError) {
        this.showError(oError);
      }
    },

    onManagerRatingChange: async function (oEvent) {
      var oAssessment = oEvent.getSource().getBindingContext("view").getObject();

      try {
        // Check if this is a second submission (employee has resubmitted)
        var bIsSecondSubmission = (oAssessment.sendBackCount || 0) >= 1;
        
        if (bIsSecondSubmission) {
          MessageBox.warning(
            "Submitting this rating will finalize the assessment and it cannot be changed afterward.",
            {
              onClose: (sAction) => {
                if (sAction === MessageBox.Action.OK) {
                  this._doManagerRatingChange(oAssessment);
                }
              }
            }
          );
          return;
        }

        this._doManagerRatingChange(oAssessment);
      } catch (oError) {
        this.showError(oError);
      }
    },

    _doManagerRatingChange: async function (oAssessment) {
      try {
        var sFinalStatus = oAssessment.finalStatus || "Open";
        if (sFinalStatus !== "Finalized" && Number(oAssessment.managerRating || 0) > 0) {
          sFinalStatus = "ManagerRated";
        }

        var oPayload = {
          employee_ID: oAssessment.employee_ID,
          cycle_ID: oAssessment.cycle_ID,
          goal_ID: oAssessment.goal_ID || null,
          assessmentType: "Year-End",
          managerRating: Number(oAssessment.managerRating || 0),
          managerComments: oAssessment.managerComments || "",
          selfRating: Number(oAssessment.selfRating || 0),
          finalStatus: sFinalStatus
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

    onFinalizeOverallAssessment: async function () {
      var oViewModel = this.getView().getModel("view");
      var aAssessments = oViewModel.getProperty("/selectedAssessments") || [];
      var aOpenAssessments = aAssessments.filter(function (oAssessment) {
        return oAssessment.finalStatus === "Submitted" ||
          oAssessment.finalStatus === "Resubmitted" ||
          oAssessment.finalStatus === "ManagerRated";
      });

      if (!aOpenAssessments.length) {
        MessageBox.error("No submitted year-end assessments are available for final rating.");
        return;
      }

      var bMissingManagerRating = aOpenAssessments.some(function (oAssessment) {
        return !Number(oAssessment.managerRating || 0);
      });

      if (bMissingManagerRating) {
        MessageBox.error("Add manager rating for each goal before submitting the overall final rating.");
        return;
      }

      // Overall final rating is computed from all goal-level manager ratings.
      var fOverallFinalRating = aOpenAssessments.reduce(function (sum, oAssessment) {
        return sum + Number(oAssessment.managerRating || 0);
      }, 0) / aOpenAssessments.length;
      var iFinalRating = Number(fOverallFinalRating.toFixed(1));

      try {
        await Promise.all(aOpenAssessments.map(function (oAssessment) {
          return this.patchEntity("Assessments", oAssessment.ID, {
            employee_ID: oAssessment.employee_ID,
            cycle_ID: oAssessment.cycle_ID,
            goal_ID: oAssessment.goal_ID || null,
            assessmentType: "Year-End",
            selfRating: Number(oAssessment.selfRating || 0),
            managerRating: Number(oAssessment.managerRating || 0),
            comments: oAssessment.comments || "",
            managerComments: oAssessment.managerComments || "",
            finalRating: iFinalRating,
            finalStatus: "Finalized"
          });
        }.bind(this)));

        this.showToast("Overall final rating submitted.");
        await this._loadData();
      } catch (oError) {
        this.showError(oError);
      }
    }
  });
});
