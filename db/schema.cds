namespace prms;

using { cuid } from '@sap/cds/common';

entity Employee : cuid {
  name        : String(111);
  role        : String(20) enum {
    Employee;
    Manager;
    HR;
  };
  manager_ID  : UUID;
  manager     : Association to Employee on manager.ID = $self.manager_ID;
}

entity OKR : cuid {
  title       : String(150);
  description : String(1000);
}

entity AppraisalCycle : cuid {
  year        : Integer;
  quarter     : String(2) enum {
    Q1;
    Q2;
    Q3;
    Q4;
  };
  status      : String(20) enum {
    Open;
    Closed;
  };
  goalsOpen   : Boolean default true;
  checkInOpen : Boolean default true;
  isCurrent   : Boolean default true;
}

entity Goal : cuid {
  title       : String(150);
  description : String(1000);
  type        : String(20) enum {
    Performance;
    Development;
  };
  status      : String(30);
  progress    : Integer;
  submissionStatus : String(20) enum {
    Draft;
    Submitted;
    Approved;
    Rejected;
  } default 'Draft';
  managerComment   : String(1000);

  employee_ID : UUID;
  okr_ID      : UUID;
  cycle_ID    : UUID;

  employee    : Association to Employee on employee.ID = $self.employee_ID;
  okr         : Association to OKR on okr.ID = $self.okr_ID;
  cycle       : Association to AppraisalCycle on cycle.ID = $self.cycle_ID;
}

annotate Goal with @(
  UI.HeaderInfo : {
    TypeName       : 'Goal',
    TypeNamePlural : 'Goals',
    Title          : {
      $Type : 'UI.DataField',
      Value : title
    },
    Description    : {
      $Type : 'UI.DataField',
      Value : status
    }
  },
  UI.SelectionFields : [
    title,
    type,
    status,
    employee,
    okr
  ],
  UI.LineItem : [
    {
      $Type : 'UI.DataField',
      Value : title,
      Label : 'Goal'
    },
    {
      $Type : 'UI.DataField',
      Value : type,
      Label : 'Type'
    },
    {
      $Type : 'UI.DataField',
      Value : status,
      Label : 'Status'
    },
    {
      $Type : 'UI.DataField',
      Value : progress,
      Label : 'Progress (%)'
    }
  ],
  UI.FieldGroup #Overview : {
    Data : [
      {
        $Type : 'UI.DataField',
        Value : title,
        Label : 'Goal Title'
      },
      {
        $Type : 'UI.DataField',
        Value : type,
        Label : 'Goal Type'
      },
      {
        $Type : 'UI.DataField',
        Value : status,
        Label : 'Status'
      },
      {
        $Type : 'UI.DataField',
        Value : progress,
        Label : 'Progress (%)'
      }
    ]
  },
  UI.FieldGroup #Alignment : {
    Data : [
      {
        $Type : 'UI.DataField',
        Value : employee,
        Label : 'Employee'
      },
      {
        $Type : 'UI.DataField',
        Value : okr,
        Label : 'OKR'
      }
    ]
  },
  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'GoalOverview',
      Label  : 'Overview',
      Target : '@UI.FieldGroup#Overview'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'GoalAlignment',
      Label  : 'Alignment',
      Target : '@UI.FieldGroup#Alignment'
    }
  ]
);

entity CheckIn : cuid {
  quarter       : String(2) enum {
    Q1;
    Q2;
    Q3;
    Q4;
  };
  status        : String(30);
  comments      : String(1000);
  notes         : String(1000);
  focusArea     : String(30) enum {
    Delivery;
    Collaboration;
    Learning;
    Quality;
  };
  selfRating    : Integer;
  progress      : Integer;
  checkInDate   : DateTime;
  employeeAcknowledged : Boolean default false;
  resubmittedOnce      : Boolean default false;

  goal_ID       : UUID;
  employee_ID   : UUID;
  cycle_ID      : UUID;

  goal          : Association to Goal on goal.ID = $self.goal_ID;
  employee      : Association to Employee on employee.ID = $self.employee_ID;
  cycle         : Association to AppraisalCycle on cycle.ID = $self.cycle_ID;
}

entity Assessment : cuid {
  employee_ID     : UUID;
  cycle_ID        : UUID;
  assessmentType  : String(20);
  selfRating      : Integer;
  managerRating   : Integer;
  finalRating     : Decimal(3, 1);
  managerComments : String(1000);
  comments        : String(1000);
  sendBackCount   : Integer default 0;
  finalStatus     : String(20) enum {
    Open;
    Finalized;
  };

  employee        : Association to Employee on employee.ID = $self.employee_ID;
  cycle           : Association to AppraisalCycle on cycle.ID = $self.cycle_ID;
}
