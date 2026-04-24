const cds = require('@sap/cds')

module.exports = cds.service.impl(function () {
  const { Goals, CheckIns, Assessments, Employees, OKRs, AppraisalCycles } = this.entities

  const getCurrentCycle = async () => {
    return SELECT.one.from(AppraisalCycles).where({ isCurrent: true })
  }

  this.before('CREATE', Goals, async req => {
    const goal = req.data
    const cycle = await getCurrentCycle()

    if (cycle && !cycle.goalsOpen) {
      return req.reject(400, 'Goals cannot be created after the quarter is closed.')
    }

    if (!goal.employee_ID) {
      return req.reject(400, 'Employee is required for a goal.')
    }

    if (goal.type === 'Performance' && !goal.okr_ID) {
      return req.reject(400, 'Performance goals must be mapped to an OKR.')
    }

    if (cycle && !goal.cycle_ID) {
      goal.cycle_ID = cycle.ID
    }

    const existingDevelopmentGoals = await SELECT.one
      .from(Goals)
      .columns('count(*) as count')
      .where({
        employee_ID: goal.employee_ID,
        type: 'Development'
      })

    const developmentCount = Number(existingDevelopmentGoals?.count || 0)
    if (goal.type !== 'Development' && developmentCount < 3) {
      return req.reject(400, 'Each employee must have at least 3 Development Goals before other goals can be created.')
    }
  })

  this.before('UPDATE', Goals, async req => {
    const cycle = await getCurrentCycle()
    if (!cycle) return

    const editableFields = ['title', 'description', 'type', 'employee_ID', 'okr_ID']
    const touchesEditableFields = editableFields.some(field => req.data[field] !== undefined)
    const touchesCheckInFields = req.data.status !== undefined || req.data.progress !== undefined

    if (touchesEditableFields && !cycle.goalsOpen) {
      return req.reject(400, 'Goal editing is closed for the current quarter.')
    }

    if (touchesCheckInFields && !cycle.checkInOpen) {
      return req.reject(400, 'Goal progress cannot be updated after the check-in window is closed.')
    }
  })

  this.before('CREATE', CheckIns, async req => {
    const cycle = await getCurrentCycle()
    if (cycle && !cycle.checkInOpen) {
      return req.reject(400, 'Quarterly check-ins are currently closed.')
    }

    if (cycle) {
      if (!req.data.cycle_ID) req.data.cycle_ID = cycle.ID
      if (!req.data.quarter) req.data.quarter = cycle.quarter
    }
  })

  this.before('UPDATE', CheckIns, async req => {
    const cycle = await getCurrentCycle()
    if (!cycle) return

    const editableFields = ['status', 'comments', 'notes', 'progress', 'goal_ID', 'employee_ID']
    const touchesEditableFields = editableFields.some(field => req.data[field] !== undefined)

    if (touchesEditableFields && !cycle.checkInOpen) {
      return req.reject(400, 'Quarterly check-ins are currently closed.')
    }
  })

  this.on('generateGoals', async req => {
    const role = req.data.role || 'Employee'
    const employees = await SELECT.from(Employees).where({ role })

    if (!employees.length) {
      return `No employees found for role ${role}.`
    }

    const okr = await SELECT.one.from(OKRs)
    const generatedTitles = []

    for (const employee of employees) {
      const existingDevelopmentGoals = await SELECT.one
        .from(Goals)
        .columns('count(*) as count')
        .where({
          employee_ID: employee.ID,
          type: 'Development'
        })

      const developmentCount = Number(existingDevelopmentGoals?.count || 0)
      const missingDevelopmentGoals = Math.max(0, 3 - developmentCount)

      for (let index = 0; index < missingDevelopmentGoals; index += 1) {
        const title = `Development Goal ${developmentCount + index + 1} for ${employee.name}`
        await INSERT.into(Goals).entries({
          title,
          type: 'Development',
          status: 'Open',
          progress: 0,
          employee_ID: employee.ID
        })
        generatedTitles.push(title)
      }

      if (okr) {
        const existingPerformanceGoal = await SELECT.one.from(Goals).where({
          employee_ID: employee.ID,
          type: 'Performance',
          okr_ID: okr.ID
        })

        if (!existingPerformanceGoal) {
          const title = `Performance Goal for ${employee.name}`
          await INSERT.into(Goals).entries({
            title,
            type: 'Performance',
            status: 'Open',
            progress: 0,
            employee_ID: employee.ID,
            okr_ID: okr.ID
          })
          generatedTitles.push(title)
        }
      }
    }

    if (!generatedTitles.length) {
      return `No new goals were needed for role ${role}.`
    }

    return `Generated goals: ${generatedTitles.join(', ')}`
  })

  this.on('submitGoalsForApproval', async req => {
    const { employeeID } = req.data

    if (!employeeID) {
      return req.reject(400, 'employeeID is required.')
    }

    const cycle = await getCurrentCycle()
    if (cycle && !cycle.goalsOpen) {
      return req.reject(400, 'Goal submission is closed for the current quarter.')
    }

    const goals = await SELECT.from(Goals).where({ employee_ID: employeeID })
    if (!goals.length) {
      return req.reject(400, 'Create goals before submitting them for approval.')
    }

    const developmentGoals = goals.filter(goal => goal.type === 'Development')
    const performanceGoals = goals.filter(goal => goal.type === 'Performance')
    if (developmentGoals.length < 3) {
      return req.reject(400, 'At least 3 development goals are required before submission.')
    }

    if (performanceGoals.length < 1) {
      return req.reject(400, 'At least 1 performance goal is required before submission.')
    }

    await UPDATE(Goals)
      .set({ submissionStatus: 'Submitted' })
      .where({ employee_ID: employeeID })

    return 'Goals submitted to the manager for approval.'
  })

  this.on('improveAssessment', req => {
    const text = (req.data.text || '').trim()
    if (!text) return 'Please provide assessment text to improve.'
    return `Improved assessment suggestion: ${text}`
  })

  this.on('submitCheckIn', async req => {
    const { goalID, comment } = req.data

    if (!goalID) {
      return req.reject(400, 'goalID is required.')
    }

    const goal = await SELECT.one.from(Goals).where({ ID: goalID })
    if (!goal) {
      return req.reject(404, 'Goal not found.')
    }

    await INSERT.into(CheckIns).entries({
      quarter: inferQuarter(),
      status: 'Submitted',
      comments: comment,
      goal_ID: goalID,
      cycle_ID: (await getCurrentCycle())?.ID
    })

    return `Check-in submitted for goal ${goalID}.`
  })

  this.on('sendBackAssessment', async req => {
    const { assessmentID } = req.data

    if (!assessmentID) {
      return req.reject(400, 'assessmentID is required.')
    }

    const assessment = await SELECT.one.from(Assessments).where({ ID: assessmentID })
    if (!assessment) {
      return req.reject(404, 'Assessment not found.')
    }

    if (assessment.finalStatus === 'Finalized') {
      return req.reject(400, 'Manager second submission is final.')
    }

    if ((assessment.sendBackCount || 0) >= 1) {
      return req.reject(400, 'Only one send-back is allowed for an assessment.')
    }

    await UPDATE(Assessments)
      .set({ sendBackCount: 1, finalStatus: 'Open' })
      .where({ ID: assessmentID })

    return `Assessment ${assessmentID} sent back successfully.`
  })

  this.before('UPDATE', Assessments, async req => {
    const current = await SELECT.one.from(Assessments).where({ ID: req.data.ID })
    if (!current) return

    if (current.finalStatus === 'Finalized' && req.data.finalStatus !== 'Open') {
      return req.reject(400, 'Finalized assessments cannot be edited unless they are sent back once.')
    }

    if (req.data.managerRating === undefined) return

    const hasManagerSubmission = current.managerRating !== null && current.managerRating !== undefined
    if (hasManagerSubmission && current.sendBackCount >= 1) {
      req.data.finalStatus = 'Finalized'
    }
  })
})

function inferQuarter() {
  const month = new Date().getUTCMonth() + 1
  if (month <= 3) return 'Q1'
  if (month <= 6) return 'Q2'
  if (month <= 9) return 'Q3'
  return 'Q4'
}
