# PRMS - Technical Documentation

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser / UI Layer                        │
│                  (SAPUI5 / OpenUI5)                          │
├─────────────────────────────────────────────────────────────┤
│  Components: Component.js, Views (XML), Controllers (JS)     │
│  Models: JSONModel (Dashboard), ODataModel (Backend)         │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│                   (Node.js / Express)                        │
├─────────────────────────────────────────────────────────────┤
│  Service Layer: service.js (CAP Implementation)              │
│  Actions: generateGoals, submitCheckIn, etc.                │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer (CDS)                          │
│           (Cloud Data Models / OData Protocol)               │
├─────────────────────────────────────────────────────────────┤
│  Database: SQLite (Dev) / HANA (Prod)                        │
│  Tables: Employees, Goals, CheckIns, Assessments, OKRs      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
prms/
├── app/                          # UI Application
│   └── prmsui/
│       ├── ui5.yaml             # UI5 Tooling Configuration
│       └── webapp/
│           ├── index.html       # Entry Point
│           ├── manifest.json    # App Manifest & Routing
│           ├── Component.js     # Root Component
│           ├── Component-preload.js
│           ├── controller/      # SAPUI5 Controllers
│           │   ├── App.controller.js
│           │   ├── Login.controller.js
│           │   └── Dashboard.controller.js
│           ├── view/            # SAPUI5 Views (XML)
│           │   ├── App.view.xml
│           │   ├── Login.view.xml
│           │   └── Dashboard.view.xml
│           ├── model/
│           │   └── mockUsers.json
│           ├── i18n/            # Internationalization
│           └── css/
│               └── style.css
│
├── db/                          # Data Models
│   ├── schema.cds              # CDS Entities
│   └── data/                   # Test Data (CSV)
│       ├── prms-Employee.csv
│       ├── prms-Goal.csv
│       ├── prms-OKR.csv
│       ├── prms-CheckIn.csv
│       └── prms-Assessment.csv
│
├── srv/                        # Services
│   ├── service.cds            # Service Definition & OData
│   └── service.js             # Service Implementation
│
├── package.json               # Dependencies
└── README.md                  # Documentation
```

---

## 🔌 API Endpoints (OData)

### Base URL: `/odata/v4/prms/`

#### Entities:

**Employees**
```
GET  /odata/v4/prms/Employees
GET  /odata/v4/prms/Employees(ID='...')
POST /odata/v4/prms/Employees
PATCH /odata/v4/prms/Employees(ID='...')
DELETE /odata/v4/prms/Employees(ID='...')
```

**Goals**
```
GET  /odata/v4/prms/Goals
GET  /odata/v4/prms/Goals(ID='...')
POST /odata/v4/prms/Goals
PATCH /odata/v4/prms/Goals(ID='...')
DELETE /odata/v4/prms/Goals(ID='...')

Filter Examples:
?$filter=employee_ID eq '11111111-1111-1111-1111-111111111111'
?$filter=type eq 'Performance'
?$filter=status eq 'Completed'
```

**OKRs**
```
GET  /odata/v4/prms/OKRs
GET  /odata/v4/prms/OKRs(ID='...')
```

**CheckIns**
```
GET  /odata/v4/prms/CheckIns
POST /odata/v4/prms/CheckIns
PATCH /odata/v4/prms/CheckIns(ID='...')
```

**Assessments**
```
GET  /odata/v4/prms/Assessments
POST /odata/v4/prms/Assessments
PATCH /odata/v4/prms/Assessments(ID='...')
```

#### Custom Actions:

**Generate Goals**
```
POST /odata/v4/prms/generateGoals(role='Employee')
Response: String (generation message)
```

**Submit Check-In**
```
POST /odata/v4/prms/submitCheckIn(goalID='...', comment='...')
Response: String (confirmation message)
```

---

## 🎮 SAPUI5 Component Structure

### Component.js
```javascript
sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  return UIComponent.extend("prmsui.Component", {
    metadata: { manifest: "json" },
    init: function() {
      // Initialize router and models
      // Load session data from sessionStorage
      // Set default models
    }
  });
});
```

### Models:
1. **Session Model** (JSONModel)
   - Stores: authenticated, user, fullName, role, employeeId, etc.
   - Scope: Global (used across all controllers)

2. **Dashboard Model** (JSONModel)
   - Stores: goals, assessments, checkIns, stats, UI state
   - Scope: Dashboard controller

3. **OData Model** (ODataModel)
   - Connects to: /odata/v4/prms/
   - Auto-handles CRUD operations
   - Two-way binding with backend

---

## 🔄 Data Flow

### Goal Creation Flow:
```
User Form Input
    ↓
Controller: onCreateGoal()
    ↓
Validation Check
    ↓
ODataModel.bindList("/Goals").create()
    ↓
service.js: CREATE Goals
    ↓
Database Insert
    ↓
Success/Error Response
    ↓
UI Update: _loadDashboardData()
    ↓
Dashboard Model Updated
    ↓
View Re-renders
```

### Assessment Finalization Flow:
```
Manager Clicks "Finalize"
    ↓
Controller: onFinalizeAssessment()
    ↓
Fetch Current Assessment
    ↓
Calculate: finalRating = (managerRating + selfRating) / 2
    ↓
Update: finalStatus = "Finalized"
    ↓
ODataModel.save()
    ↓
Database Update
    ↓
Dashboard Refreshes
    ↓
Status Changes to "Finalized"
```

---

## 🔐 Authentication & Authorization

### Login Flow:
```javascript
// Login.controller.js
onLogin: function() {
  var oUser = findUser(username, password); // From mockUsers.json
  
  if (oUser) {
    // Store session
    window.sessionStorage.setItem("PRMS_SESSION", JSON.stringify(oUser));
    
    // Update session model
    this.getOwnerComponent().getModel("session").setData(oUser);
    
    // Navigate to dashboard
    this.getOwnerComponent().getRouter().navTo("dashboard");
  }
}
```

### Role-Based Access Control (RBAC):
```xml
<!-- View-level control -->
<Panel visible="{session>/isEmployee}">...</Panel>
<Panel visible="{session>/isManager}">...</Panel>
<Panel visible="{session>/isHRAdmin}">...</Panel>

<!-- Controller-level filtering -->
aVisibleGoals = session.isEmployee 
  ? myGoals 
  : session.isManager 
    ? teamGoals 
    : allGoals;
```

---

## 📊 Data Models (CDS)

### Employee Entity:
```cds
entity Employee : cuid {
  name : String(111);
  role : String(20) enum { Employee; Manager; HR; };
}
```

### Goal Entity:
```cds
entity Goal : cuid {
  title       : String(150);
  description : String(1000);
  type        : String(20) enum { Performance; Development; };
  status      : String(30);
  progress    : Integer;
  
  employee_ID : UUID;
  okr_ID      : UUID;
  
  employee    : Association to Employee;
  okr         : Association to OKR;
}
```

### Assessment Entity:
```cds
entity Assessment : cuid {
  employee_ID     : UUID;
  assessmentType  : String(20);
  selfRating      : Integer;      // 1-5
  managerRating   : Integer;      // 1-5
  finalRating     : Decimal(3,1); // Calculated
  finalStatus     : String(20) enum { Open; Finalized; };
  
  employee        : Association to Employee;
}
```

### CheckIn Entity:
```cds
entity CheckIn : cuid {
  quarter       : String(2) enum { Q1; Q2; Q3; Q4; };
  status        : String(30);
  notes         : String(1000);
  progress      : Integer;        // 0-100
  checkInDate   : DateTime;
  
  goal_ID       : UUID;
  employee_ID   : UUID;
  
  goal          : Association to Goal;
  employee      : Association to Employee;
}
```

---

## 🧪 Testing with curl

### Get All Employees:
```bash
curl -X GET "http://localhost:4004/odata/v4/prms/Employees"
```

### Create Goal:
```bash
curl -X POST "http://localhost:4004/odata/v4/prms/Goals" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Goal",
    "type": "Development",
    "status": "Open",
    "progress": 0,
    "employee_ID": "11111111-1111-1111-1111-111111111111"
  }'
```

### Generate Goals:
```bash
curl -X POST "http://localhost:4004/odata/v4/prms/generateGoals(role='Employee')"
```

---

## 🐛 Debugging

### Browser Developer Tools:
1. **Console**: Check for JavaScript errors
2. **Network**: Monitor API calls
3. **Storage**: View sessionStorage and localStorage
4. **Application**: Inspect bound models

### Key Debugging Points:
```javascript
// Dashboard.controller.js - Check data loading
_loadDashboardData: async function() {
  console.log("Loading dashboard data...");
  var aResults = await Promise.all([...]);
  console.log("Goals loaded:", aResults[0]);
  console.log("Assessments loaded:", aResults[2]);
}

// View - Check binding
<Text text="{dashboard>title}" visible="true" />
```

---

## 🚀 Deployment

### Production Build:
```bash
npm run build
```

### Deploy to SAP Cloud:
```bash
cf push
```

### Environment Variables:
```
DB_HOST=
DB_PORT=30015
DB_USER=
DB_PASSWORD=
NODE_ENV=production
```

---

## 📈 Performance Considerations

1. **OData Queries**: Limit results with $top, use $filter
2. **Lazy Loading**: Load data on demand (implemented via requestContexts)
3. **UI Updates**: Batch model updates to reduce re-renders
4. **Caching**: Use sessionStorage for session data

---

## 🔄 Version Control

**Branch Strategy**:
```
main          (Production)
├── develop   (Integration)
├── feature/* (Features)
└── bugfix/*  (Bug fixes)
```

---

## 📚 Dependencies

**Frontend**:
- @sapui5/sdk (OpenUI5)
- @sap/cds (Local)

**Backend**:
- @sap/cds
- sqlite3

**Dev**:
- @ui5/cli
- fiori-tools

---

**Last Updated**: 2026-04-16  
**Maintained By**: Development Team
