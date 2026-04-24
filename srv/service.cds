using { prms as db } from '../db/schema';

service PRMSService {
  entity Employees   as projection on db.Employee;
  entity Goals       as projection on db.Goal;
  entity OKRs        as projection on db.OKR;
  entity AppraisalCycles as projection on db.AppraisalCycle;
  entity CheckIns    as projection on db.CheckIn;
  entity Assessments as projection on db.Assessment;

  action generateGoals(role : String) returns String;
  action improveAssessment(text : String) returns String;
  action submitGoalsForApproval(employeeID : UUID) returns String;
  action submitCheckIn(goalID : UUID, comment : String) returns String;
  action sendBackAssessment(assessmentID : UUID) returns String;
}
