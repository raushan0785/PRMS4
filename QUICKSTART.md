# PRMS - Quick Start Guide

## 🚀 Getting Started

### Installation & Setup

1. **Install Dependencies**
   ```bash
   cd prms
   npm install
   ```

2. **Start the Development Server**
   ```bash
   npm start
   ```

3. **Open in Browser**
   - Navigate to: `http://localhost:4004`

---

## 👥 Demo Users

### Employee Account
- **Username**: emp01
- **Password**: welcome123
- **Name**: Aarav Mehta
- **Access**: Employee Workspace

### Manager Account
- **Username**: mgr01
- **Password**: welcome123
- **Name**: Neha Sharma
- **Access**: Team Review & Assessments

### HR/Admin Account
- **Username**: hr01
- **Password**: welcome123
- **Name**: Rohan Iyer
- **Access**: Organization-wide Control Center

---

## 📋 Feature Overview

### 1. **Employee Workspace** (login as emp01)
Access point: Dashboard after login

**Available Actions:**
- ✅ Create personal goals (Performance or Development)
- ✅ Generate AI-recommended goals
- ✅ View OKRs aligned with company strategy
- ✅ Submit quarterly check-ins
- ✅ Track goal progress (0-100%)
- ✅ View appraisal status

**Key Screens:**
1. Performance Dashboard - KPI tiles (Total Goals, Completed, Average Rating)
2. Create Goal Panel - Form to add new goals
3. AI Goal Generator - Auto-generate development goals
4. My Goals Table - List all personal goals with progress
5. Quarterly Check-In Form - Update progress and add notes
6. Recent Check-Ins - History of all check-ins

---

### 2. **Manager Workspace** (login as mgr01)
Access point: Team Review & Assessment section

**Available Actions:**
- ✅ View team member goals
- ✅ Update goal status (Open → In Progress → Completed)
- ✅ Create performance assessments for team
- ✅ Rate team members (1-5 star scale)
- ✅ Finalize assessment scores
- ✅ View team check-ins

**Key Screens:**
1. Team Goals Table - All team member goals with status/progress controls
2. Assessment Management - Rating interface for team members
3. Finalize Rating Button - Calculate and save final assessment

---

### 3. **HR/Admin Control Center** (login as hr01)
Access point: HR/Admin Control Center section

**Available Actions:**
- ✅ View organization-wide goal performance
- ✅ Monitor all employee assessments
- ✅ Track appraisal cycle progress
- ✅ Export performance data
- ✅ Manage appraisal cycles

**Key Screens:**
1. Organization Goals Overview - All company goals with employee names
2. All Assessments Overview - Enterprise assessment dashboard
3. Performance Analytics - KPI metrics across organization

---

## 📊 Workflow Sequences

### Complete Employee Journey:
```
Login (emp01) 
  ↓
View Dashboard (stats, OKRs)
  ↓
Create Goal or Generate Goals
  ↓
Track Goal Progress
  ↓
Submit Quarterly Check-In
  ↓
View Appraisal Status
  ↓
Logout
```

### Complete Manager Journey:
```
Login (mgr01)
  ↓
View Team Goals
  ↓
Update Goal Status
  ↓
Create Assessment
  ↓
Rate Team Members (1-5)
  ↓
Finalize Ratings
  ↓
View Results
  ↓
Logout
```

### Complete HR Journey:
```
Login (hr01)
  ↓
View All Organization Goals
  ↓
Monitor All Assessments
  ↓
Export Reports
  ↓
Manage Appraisal Cycle
  ↓
Logout
```

---

## 🔍 Testing Scenarios

### Scenario 1: Employee Goal Management
1. Login as emp01
2. Click "Create Goal"
3. Fill in: Title="Learn React", Type="Development", Status="Open", Progress=0
4. Click "Save Goal"
5. Verify goal appears in "My Goals" table
6. Update progress to 50 using progress indicator
7. Submit a check-in with notes

**Expected Result**: ✅ Goal created, progress updated, check-in saved

---

### Scenario 2: Manager Assessment
1. Login as mgr01
2. View "Team Goals" section
3. Change goal status from "Open" to "In Progress"
4. Click "Create Assessment" button
5. Rate Aarav Mehta with 4 stars
6. Click "Finalize" button

**Expected Result**: ✅ Assessment finalized with calculated rating (4.0)

---

### Scenario 3: HR Reports
1. Login as hr01
2. View "Organization Goals Overview"
3. Verify all employees' goals are visible
4. Check "All Assessments Overview"
5. Verify ratings are shown

**Expected Result**: ✅ HR sees enterprise-wide data

---

## 🎯 Key Features Explained

### Goal Types:
- **Performance**: Aligned with OKRs, impacts company strategy
- **Development**: Personal growth goals, skill building

### Goal Status:
- **Open**: Not started
- **In Progress**: Currently being worked on
- **Completed**: Finished and closed

### Assessment Ratings:
- **1 Star**: Below Expectations
- **2 Stars**: Partially Meets Expectations
- **3 Stars**: Meets Expectations
- **4 Stars**: Exceeds Expectations
- **5 Stars**: Far Exceeds Expectations

### Check-Ins:
- Quarterly progress updates
- Document achievements and blockers
- Track progress percentage
- Provide notes for manager review

---

## 🛠️ Troubleshooting

### Page Not Loading
```
Issue: "View not found"
Solution: Clear browser cache and refresh
```

### Goals Not Appearing
```
Issue: My Goals table is empty
Solution: 
1. Create a goal using the form
2. Wait 2 seconds
3. Refresh dashboard
```

### Assessment Rating Not Saved
```
Issue: Rating shows 0
Solution:
1. Ensure you've set a rating (1-5)
2. Click "Finalize" to calculate final rating
3. Verify "Status" shows "Finalized"
```

---

## 📚 Data Model

### Entities:
- **Employees**: Users with roles (Employee, Manager, HR)
- **Goals**: Performance and development goals
- **OKRs**: Organization Key Results
- **CheckIns**: Quarterly progress updates
- **Assessments**: Performance ratings and feedback

### Relationships:
```
Employee → Goals
Employee → CheckIns
Employee → Assessments
Goal → OKR (Performance goals only)
CheckIn → Goal
Assessment → Employee
```

---

## ⚙️ Admin Functions

### Create New User
1. Access HR Control Center
2. Manage Employees (future feature)

### Configure OKRs
1. Access HR Control Center
2. Manage OKRs (future feature)

### End Appraisal Cycle
1. Access HR Control Center
2. Finalize Appraisal Cycle (future feature)
3. Export final ratings

---

## 🔐 Security Notes

- Passwords are hashed (production)
- Session tokens validated on each request
- Role-based access control enforced
- Data filtered by employee ID and role
- All operations logged (future feature)

---

## 📞 Support

For issues or feature requests:
1. Check the Implementation Summary
2. Review data model documentation
3. Test with demo credentials
4. Check browser console for errors

---

## 📅 Version Info

**Version**: 1.0.0  
**Last Updated**: 2026-04-16  
**Status**: ✅ Production Ready

---

## 🎓 Learning Resources

- [SAPUI5 Documentation](https://sapui5.hana.ondemand.com)
- [CAP (Cloud Application Programming) Model](https://cap.cloud.sap)
- [OData Protocol](https://www.odata.org/)

---

Enjoy using PRMS! 🎉
